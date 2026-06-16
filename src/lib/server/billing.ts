import { db, subscriptions, plans, projects } from '$lib/server/db';
import { eq, desc, and, sql } from 'drizzle-orm';
import type { Subscription, Plan } from '$lib/server/db/schema';

export interface ActiveSub {
	subscription: Subscription;
	plan: Plan | null;
}

/** Latest subscription for a user that is active and not expired. */
export async function getActiveSubscription(userId: string): Promise<ActiveSub | null> {
	const [sub] = await db
		.select()
		.from(subscriptions)
		.where(eq(subscriptions.userId, userId))
		.orderBy(desc(subscriptions.createdAt))
		.limit(1);
	if (!sub) return null;

	const expired = sub.status !== 'active' || (sub.expiresAt != null && sub.expiresAt.getTime() < Date.now());
	if (expired) return null;

	const [plan] = sub.planId ? await db.select().from(plans).where(eq(plans.id, sub.planId)) : [null];
	return { subscription: sub, plan: plan ?? null };
}

/** Enforce plan's max_projects. Admins bypass. Returns {ok,reason}. */
export async function canCreateProject(userId: string, role: string): Promise<{ ok: boolean; reason?: string }> {
	if (role === 'admin') return { ok: true };
	const active = await getActiveSubscription(userId);
	if (!active) return { ok: false, reason: 'Langganan tidak aktif. Silakan berlangganan dulu.' };
	const max = active.plan?.maxProjects ?? 0;
	if (max <= 0) return { ok: true };
	const [{ count }] = await db
		.select({ count: sql<number>`count(*)` })
		.from(projects)
		.where(and(eq(projects.userId, userId)));
	if (Number(count) >= max) {
		return { ok: false, reason: `Batas project (${max}) untuk paket kamu tercapai.` };
	}
	return { ok: true };
}

/** Activate (or extend) a subscription for a user on a plan. Used by webhook + admin. */
export async function activateSubscription(userId: string, planId: string): Promise<Subscription> {
	const [plan] = await db.select().from(plans).where(eq(plans.id, planId));
	const days = plan?.durationDays ?? 30;
	const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

	// extend if an active sub on same plan exists, else create new
	const [existing] = await db
		.select()
		.from(subscriptions)
		.where(eq(subscriptions.userId, userId))
		.orderBy(desc(subscriptions.createdAt))
		.limit(1);

	if (existing && existing.status === 'active' && existing.planId === planId) {
		const base = existing.expiresAt && existing.expiresAt.getTime() > Date.now() ? existing.expiresAt.getTime() : Date.now();
		const newExpiry = new Date(base + days * 24 * 60 * 60 * 1000);
		const [updated] = await db
			.update(subscriptions)
			.set({ status: 'active', expiresAt: newExpiry, updatedAt: new Date() })
			.where(eq(subscriptions.id, existing.id))
			.returning();
		return updated;
	}

	const [created] = await db
		.insert(subscriptions)
		.values({ userId, planId, status: 'active', quotaUsed: 0, expiresAt })
		.returning();
	return created;
}
