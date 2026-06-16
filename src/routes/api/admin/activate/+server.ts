import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, users, plans } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { activateSubscription } from '$lib/server/billing';

// Admin fallback to manually activate a subscription (demo/testing).
export const POST: RequestHandler = async ({ request, locals }) => {
	if (locals.user?.role !== 'admin') return json({ error: 'Forbidden' }, { status: 403 });

	const { email, userId, planId, planName } = await request.json();

	let targetId = userId as string | undefined;
	if (!targetId && email) {
		const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, String(email).toLowerCase()));
		if (!u) return json({ error: 'User tidak ditemukan' }, { status: 404 });
		targetId = u.id;
	}
	if (!targetId) return json({ error: 'email atau userId wajib' }, { status: 400 });

	let plan: { id: string } | undefined;
	if (planId) {
		[plan] = await db.select({ id: plans.id }).from(plans).where(eq(plans.id, planId));
	} else if (planName) {
		[plan] = await db.select({ id: plans.id }).from(plans).where(eq(plans.name, planName));
	} else {
		// default to cheapest active plan
		[plan] = await db.select({ id: plans.id }).from(plans).where(eq(plans.isActive, true)).limit(1);
	}
	if (!plan) return json({ error: 'Plan tidak ditemukan' }, { status: 404 });

	const sub = await activateSubscription(targetId, plan.id);
	return json({ ok: true, subscription_id: sub.id, expires_at: sub.expiresAt });
};
