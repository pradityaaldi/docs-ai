import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, documents, messages } from '$lib/server/db';
import { eq, asc } from 'drizzle-orm';
import { snakeify } from '$lib/server/serialize';

export const GET: RequestHandler = async ({ params }) => {
	const rows = await db
		.select()
		.from(messages)
		.where(eq(messages.documentId, params.id))
		.orderBy(asc(messages.createdAt));
	return json(snakeify(rows));
};

export const POST: RequestHandler = async ({ params, request }) => {
	const data = await request.json();
	const { role, content } = data;
	if (!role || !content) {
		return json({ error: 'Missing role or content' }, { status: 400 });
	}
	const [msg] = await db
		.insert(messages)
		.values({ documentId: params.id, role, content })
		.returning();
	return json(snakeify(msg), { status: 201 });
};

export const DELETE: RequestHandler = async ({ params }) => {
	await db.delete(messages).where(eq(messages.documentId, params.id));
	await db.update(documents).set({ content: '', updatedAt: new Date() }).where(eq(documents.id, params.id));
	return json({ success: true });
};
