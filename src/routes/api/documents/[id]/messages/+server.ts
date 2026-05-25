import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import getDb from '$lib/server/db';

// GET /api/documents/[id]/messages - get messages for document
export const GET: RequestHandler = async ({ params }) => {
	const db = getDb();
	const messages = db.prepare('SELECT * FROM messages WHERE document_id = ? ORDER BY created_at ASC').all(params.id);
	return json(messages);
};

// POST /api/documents/[id]/messages - add message to document
export const POST: RequestHandler = async ({ params, request }) => {
	const db = getDb();
	const data = await request.json();
	const { role, content } = data;

	if (!role || !content) {
		return json({ error: 'Missing role or content' }, { status: 400 });
	}

	const id = crypto.randomUUID();
	db.prepare(
		`INSERT INTO messages (id, document_id, role, content) VALUES (?, ?, ?, ?)`
	).run(id, params.id, role, content);

	return json({ id, document_id: params.id, role, content }, { status: 201 });
};

// DELETE /api/documents/[id]/messages - clear all messages for document
export const DELETE: RequestHandler = async ({ params }) => {
	const db = getDb();
	db.prepare('DELETE FROM messages WHERE document_id = ?').run(params.id);
	db.prepare("UPDATE documents SET content = '', updated_at = datetime('now') WHERE id = ?").run(params.id);
	return json({ success: true });
};