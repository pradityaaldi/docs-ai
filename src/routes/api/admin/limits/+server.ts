import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, aiLimits } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { snakeify } from '$lib/server/serialize';
import { notAdmin } from '$lib/server/admin-guard';

export const GET: RequestHandler = async ({ locals }) => {
	const denied = notAdmin(locals);
	if (denied) return denied;
	let [row] = await db.select().from(aiLimits).limit(1);
	if (!row) {
		[row] = await db.insert(aiLimits).values({}).returning();
	}
	return json(snakeify(row));
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	const denied = notAdmin(locals);
	if (denied) return denied;
	const b = await request.json();

	const patch = {
		enabled: !!b.enabled,
		dailyTokenCap: Number(b.daily_token_cap ?? b.dailyTokenCap ?? 0),
		monthlyCostCap: Number(b.monthly_cost_cap ?? b.monthlyCostCap ?? 0),
		perUserDailyCap: Number(b.per_user_daily_cap ?? b.perUserDailyCap ?? 0),
		ratePerMin: Number(b.rate_per_min ?? b.ratePerMin ?? 0),
		maxTokensPerReq: Number(b.max_tokens_per_req ?? b.maxTokensPerReq ?? 0),
		warnThresholdPct: Number(b.warn_threshold_pct ?? b.warnThresholdPct ?? 80),
		updatedAt: new Date()
	};

	let [row] = await db.select({ id: aiLimits.id }).from(aiLimits).limit(1);
	if (!row) {
		[row] = await db.insert(aiLimits).values(patch).returning({ id: aiLimits.id });
	} else {
		await db.update(aiLimits).set(patch).where(eq(aiLimits.id, row.id));
	}
	const [updated] = await db.select().from(aiLimits).limit(1);
	return json(snakeify(updated));
};
