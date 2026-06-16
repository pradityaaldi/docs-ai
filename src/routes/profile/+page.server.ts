import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db, users } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { getActiveSubscription } from '$lib/server/billing';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/auth/login');

	const [row] = await db
		.select({ createdAt: users.createdAt })
		.from(users)
		.where(eq(users.id, locals.user.id))
		.limit(1);

	const active = await getActiveSubscription(locals.user.id);

	return {
		user: { ...locals.user, createdAt: row?.createdAt ?? null },
		subscription: active
			? {
					planName: active.plan?.name ?? null,
					status: active.subscription.status,
					quota: active.plan?.quota ?? 0,
					quotaUsed: active.subscription.quotaUsed,
					expiresAt: active.subscription.expiresAt?.toISOString() ?? null
				}
			: null
	};
};
