import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import getDb from '$lib/server/db';

// GET /api/documents - list all documents
export const GET: RequestHandler = async () => {
	const db = getDb();
	const documents = db.prepare('SELECT id, title, content, connector_id, created_at, updated_at FROM documents ORDER BY updated_at DESC').all();
	return json(documents);
};

// POST /api/documents - create document
export const POST: RequestHandler = async ({ request }) => {
	const db = getDb();
	const data = await request.json();
	const { title, content, connector_id } = data;

	const id = crypto.randomUUID();
	db.prepare(
		`INSERT INTO documents (id, title, content, connector_id) VALUES (?, ?, ?, ?)`
	).run(id, title || 'Untitled Document', content || '', connector_id || null);

	const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
	return json(doc, { status: 201 });
};