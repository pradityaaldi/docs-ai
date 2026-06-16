import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db, templates } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { getActiveSubscription } from '$lib/server/billing';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) throw redirect(302, '/auth/login');
	if (locals.user.role !== 'admin' && !(await getActiveSubscription(locals.user.id))) {
		throw redirect(302, '/billing');
	}

	const [tpl] = await db.select().from(templates).where(eq(templates.slug, params.slug));
	if (!tpl || !tpl.isActive) throw error(404, 'Template tidak ditemukan');

	return {
		template: {
			name: tpl.name,
			slug: tpl.slug,
			category: tpl.category,
			kampus: tpl.kampus,
			description: tpl.description,
			formFields: tpl.formFields as Array<{
				key: string;
				label: string;
				type: 'text' | 'textarea' | 'select';
				placeholder?: string;
				options?: string[];
				required?: boolean;
			}>
		}
	};
};
