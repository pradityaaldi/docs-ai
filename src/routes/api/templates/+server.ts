import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, templates } from '$lib/server/db';
import { eq, and, asc } from 'drizzle-orm';
import { snakeify } from '$lib/server/serialize';

export const GET: RequestHandler = async ({ url }) => {
	const category = url.searchParams.get('category');
	const where = category
		? and(eq(templates.isActive, true), eq(templates.category, category as 'skripsi' | 'makalah' | 'surat'))
		: eq(templates.isActive, true);

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
		.where(where)
		.orderBy(asc(templates.category), asc(templates.name));

	return json(snakeify(rows));
};
