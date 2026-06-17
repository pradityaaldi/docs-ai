import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, messages } from '$lib/server/db';
import { eq, asc } from 'drizzle-orm';
import { snakeify } from '$lib/server/serialize';

// Per-project conversation history. Chat is isolated per project.

export const GET: RequestHandler = async ({ params }) => {
	const rows = await db
		.select()
		.from(messages)
		.where(eq(messages.projectId, params.id))
		.orderBy(asc(messages.createdAt));
	return json(snakeify(rows));
};

export const DELETE: RequestHandler = async ({ params }) => {
	await db.delete(messages).where(eq(messages.projectId, params.id));
	return json({ success: true });
};
