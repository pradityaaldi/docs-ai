import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, documents } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { snakeify } from '$lib/server/serialize';

export const GET: RequestHandler = async ({ params }) => {
	const [doc] = await db.select().from(documents).where(eq(documents.id, params.id));
	if (!doc) return json({ error: 'Not found' }, { status: 404 });
	return json(snakeify(doc));
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const data = await request.json();
	const { title, content } = data;

	const [updated] = await db
		.update(documents)
		.set({ title, content, updatedAt: new Date() })
		.where(eq(documents.id, params.id))
		.returning();
	if (!updated) return json({ error: 'Not found' }, { status: 404 });
	return json(snakeify(updated));
};

export const DELETE: RequestHandler = async ({ params }) => {
	// messages cascade with the document
	await db.delete(documents).where(eq(documents.id, params.id));
	return json({ success: true });
};
