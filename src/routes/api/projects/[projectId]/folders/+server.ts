import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import getDb from '$lib/server/db';

export const GET: RequestHandler = async ({ params }) => {
	const db = getDb();
	const folders = db.prepare('SELECT * FROM folders WHERE project_id = ? AND parent_id IS NULL ORDER BY name ASC').all(params.projectId);
	return json(folders);
};

export const POST: RequestHandler = async ({ params, request }) => {
	const db = getDb();
	const data = await request.json();
	const { name, parent_id } = data;

	if (!name || !name.trim()) {
		return json({ error: 'Name is required' }, { status: 400 });
	}

	const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(params.projectId);
	if (!project) return json({ error: 'Project not found' }, { status: 404 });

	if (parent_id) {
		const parent = db.prepare('SELECT id FROM folders WHERE id = ? AND project_id = ?').get(parent_id, params.projectId);
		if (!parent) return json({ error: 'Parent folder not found' }, { status: 404 });
	}

	const id = crypto.randomUUID();
	db.prepare('INSERT INTO folders (id, name, project_id, parent_id) VALUES (?, ?, ?, ?)').run(id, name.trim(), params.projectId, parent_id || null);
	db.prepare("UPDATE projects SET updated_at=datetime('now') WHERE id=?").run(params.projectId);

	const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(id);
	return json(folder, { status: 201 });
};
