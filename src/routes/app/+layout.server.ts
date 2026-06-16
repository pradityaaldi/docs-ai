import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getActiveSubscription } from '$lib/server/billing';

export const load: LayoutServerLoad = async ({ locals }) => {
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
