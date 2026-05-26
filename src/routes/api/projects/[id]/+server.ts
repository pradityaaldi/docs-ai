import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import getDb from '$lib/server/db';

export const GET: RequestHandler = async ({ params }) => {
	const db = getDb();
	const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(params.id);
	if (!project) return json({ error: 'Not found' }, { status: 404 });
	return json(project);
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const db = getDb();
	const data = await request.json();
	const { name } = data;

	if (!name || !name.trim()) {
		return json({ error: 'Name is required' }, { status: 400 });
	}

	db.prepare("UPDATE projects SET name=?, updated_at=datetime('now') WHERE id=?").run(name.trim(), params.id);

	const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(params.id);
	if (!updated) return json({ error: 'Not found' }, { status: 404 });
	return json(updated);
};

export const DELETE: RequestHandler = async ({ params }) => {
	const db = getDb();
	db.prepare('DELETE FROM messages WHERE document_id IN (SELECT id FROM documents WHERE project_id = ?)').run(params.id);
	db.prepare('DELETE FROM documents WHERE project_id = ?').run(params.id);
	db.prepare('DELETE FROM folders WHERE project_id = ?').run(params.id);
	db.prepare('DELETE FROM projects WHERE id = ?').run(params.id);
	return json({ success: true });
};
