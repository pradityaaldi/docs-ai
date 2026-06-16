import { db, aiLimits, aiGenerations, subscriptions, plans } from '$lib/server/db';
import { eq, and, gte, sql } from 'drizzle-orm';
import { sendAlert } from '$lib/server/telegram';

export interface GateResult {
	ok: boolean;
	reason?: string;
}

function startOfDay(): Date {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	return d;
}
function startOfMonth(): Date {
	const d = new Date();
	d.setDate(1);
	d.setHours(0, 0, 0, 0);
	return d;
}

/**
 * Safety + quota gate before an AI generation. Order:
 *  1. kill switch
 *  2. rate limit (req/min per user)
 *  3. per-user daily token cap
 *  4. global daily token cap
 *  5. global monthly cost cap
 *  6. subscription quota (consume on pass)
 * Fires debounced Telegram alerts on threshold/cap.
 */
export async function checkAndConsumeQuota(userId: string): Promise<GateResult> {
	const [limits] = await db.select().from(aiLimits).limit(1);

	if (limits) {
		// 1. kill switch
		if (!limits.enabled) return { ok: false, reason: 'AI sedang dinonaktifkan oleh admin.' };

		// 2. rate limit per user
		if (limits.ratePerMin > 0) {
			const since = new Date(Date.now() - 60_000);
			const [{ c }] = await db
				.select({ c: sql<number>`count(*)` })
				.from(aiGenerations)
				.where(and(eq(aiGenerations.userId, userId), gte(aiGenerations.createdAt, since)));
			if (Number(c) >= limits.ratePerMin) {
				return { ok: false, reason: 'Terlalu cepat. Tunggu sebentar sebelum generate lagi.' };
			}
		}

		// 3. per-user daily token cap
		if (limits.perUserDailyCap > 0) {
			const [{ used }] = await db
				.select({ used: sql<number>`coalesce(sum(${aiGenerations.totalTokens}), 0)` })
				.from(aiGenerations)
				.where(and(eq(aiGenerations.userId, userId), gte(aiGenerations.createdAt, startOfDay())));
			if (Number(used) >= limits.perUserDailyCap) {
				await sendAlert('abuse', `User ${userId} melebihi batas harian per-user.`);
				return { ok: false, reason: 'Batas harian pemakaian AI tercapai. Coba lagi besok.' };
			}
		}

		// 4. global daily token cap
		if (limits.dailyTokenCap > 0) {
			const [{ used }] = await db
				.select({ used: sql<number>`coalesce(sum(${aiGenerations.totalTokens}), 0)` })
				.from(aiGenerations)
				.where(gte(aiGenerations.createdAt, startOfDay()));
			const u = Number(used);
			if (u >= limits.dailyTokenCap) {
				await sendAlert('budget', `Cap token harian global tercapai (${u}/${limits.dailyTokenCap}). AI dipause.`);
				return { ok: false, reason: 'Kapasitas AI harian penuh. Coba lagi besok.' };
			}
			if (u >= (limits.dailyTokenCap * limits.warnThresholdPct) / 100) {
				await sendAlert('budget', `Token harian ${Math.round((u / limits.dailyTokenCap) * 100)}% (${u}/${limits.dailyTokenCap}).`);
			}
		}

		// 5. global monthly cost cap
		if (limits.monthlyCostCap > 0) {
			const [{ cost }] = await db
				.select({ cost: sql<number>`coalesce(sum(${aiGenerations.cost}), 0)` })
				.from(aiGenerations)
				.where(gte(aiGenerations.createdAt, startOfMonth()));
			const c = Number(cost);
			if (c >= limits.monthlyCostCap) {
				await sendAlert('budget', `Cap biaya bulanan tercapai ($${c.toFixed(2)}/$${limits.monthlyCostCap}). AI dipause.`);
				return { ok: false, reason: 'Anggaran AI bulan ini habis.' };
			}
			if (c >= (limits.monthlyCostCap * limits.warnThresholdPct) / 100) {
				await sendAlert('budget', `Biaya bulanan ${Math.round((c / limits.monthlyCostCap) * 100)}% ($${c.toFixed(2)}/$${limits.monthlyCostCap}).`);
			}
		}
	}

	// 6. subscription quota
	const [sub] = await db
		.select()
		.from(subscriptions)
		.where(eq(subscriptions.userId, userId))
		.orderBy(sql`${subscriptions.createdAt} desc`)
		.limit(1);

	if (sub) {
		const expired = sub.status !== 'active' || (sub.expiresAt && sub.expiresAt.getTime() < Date.now());
		if (expired) return { ok: false, reason: 'Langganan tidak aktif. Silakan berlangganan dulu.' };

		const [plan] = sub.planId ? await db.select().from(plans).where(eq(plans.id, sub.planId)) : [undefined];
		const quota = plan?.quota ?? 0;
		if (quota > 0 && sub.quotaUsed >= quota) {
			return { ok: false, reason: 'Kuota generate habis. Upgrade paket kamu.' };
		}
		await db
			.update(subscriptions)
			.set({ quotaUsed: sub.quotaUsed + 1, updatedAt: new Date() })
			.where(eq(subscriptions.id, sub.id));
	}

	return { ok: true };
}

/** Max tokens per request, from ai_limits (0 = unlimited → fall back to default). */
export async function maxTokensPerReq(fallback = 16384): Promise<number> {
	const [limits] = await db.select({ m: aiLimits.maxTokensPerReq }).from(aiLimits).limit(1);
	return limits && limits.m > 0 ? limits.m : fallback;
}
