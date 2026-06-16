import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db, plans } from '$lib/server/db';
import { eq, asc } from 'drizzle-orm';
import { getActiveSubscription } from '$lib/server/billing';
import { midtransConfigured } from '$lib/server/midtrans';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/auth/login');

	const planRows = await db
		.select()
		.from(plans)
		.where(eq(plans.isActive, true))
		.orderBy(asc(plans.price));

	const active = await getActiveSubscription(locals.user.id);

	return {
		user: locals.user,
		plans: planRows.map((p) => ({
			id: p.id,
			name: p.name,
			quota: p.quota,
			maxProjects: p.maxProjects,
			price: p.price,
			durationDays: p.durationDays
		})),
		active: active
			? { planName: active.plan?.name ?? null, expiresAt: active.subscription.expiresAt?.toISOString() ?? null, quotaUsed: active.subscription.quotaUsed }
			: null,
		paymentReady: midtransConfigured()
	};
};
