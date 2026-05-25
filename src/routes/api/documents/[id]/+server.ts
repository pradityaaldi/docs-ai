import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import getDb from '$lib/server/db';

// GET /api/documents/[id] - get document
export const GET: RequestHandler = async ({ params }) => {
	const db = getDb();
	const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(params.id);
	if (!doc) return json({ error: 'Not found' }, { status: 404 });
	return json(doc);
};

// PUT /api/documents/[id] - update document
export const PUT: RequestHandler = async ({ params, request }) => {
	const db = getDb();
	const data = await request.json();
	const { title, content, connector_id } = data;

	db.prepare(
		`UPDATE documents SET title=?, content=?, connector_id=?, updated_at=datetime('now') WHERE id=?`
	).run(title, content, connector_id || null, params.id);

	const updated = db.prepare('SELECT * FROM documents WHERE id = ?').get(params.id);
	return json(updated);
};

// DELETE /api/documents/[id] - delete document
export const DELETE: RequestHandler = async ({ params }) => {
	const db = getDb();
	db.prepare('DELETE FROM messages WHERE document_id = ?').run(params.id);
	db.prepare('DELETE FROM documents WHERE id = ?').run(params.id);
	return json({ success: true });
};