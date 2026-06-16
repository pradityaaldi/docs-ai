import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db, templates } from '$lib/server/db';
import { eq, asc } from 'drizzle-orm';
import { getActiveSubscription } from '$lib/server/billing';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/auth/login');
	if (locals.user.role !== 'admin' && !(await getActiveSubscription(locals.user.id))) {
		throw redirect(302, '/billing');
	}

	const rows = await db
		.select({
			id: templates.id,
			name: templates.name,
			slug: templates.slug,
			category: templates.category,
			kampus: templates.kampus,
			org: templates.org,
			description: templates.description
		})
		.from(templates)
		.where(eq(templates.isActive, true))
		.orderBy(asc(templates.category), asc(templates.name));

	return { templates: rows, user: locals.user };
};
