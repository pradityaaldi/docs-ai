import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getActiveSubscription } from '$lib/server/billing';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}
	// hard paywall — admins bypass
	if (locals.user.role !== 'admin') {
		const sub = await getActiveSubscription(locals.user.id);
		if (!sub) throw redirect(302, '/billing');
	}
	return { user: locals.user };
};
