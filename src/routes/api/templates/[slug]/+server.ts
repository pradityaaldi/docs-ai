import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, templates } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { snakeify } from '$lib/server/serialize';

export const GET: RequestHandler = async ({ params }) => {
	const [tpl] = await db.select().from(templates).where(eq(templates.slug, params.slug));
	if (!tpl || !tpl.isActive) return json({ error: 'Template tidak ditemukan' }, { status: 404 });
	return json(snakeify(tpl));
};
