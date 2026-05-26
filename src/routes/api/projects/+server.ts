import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import getDb from '$lib/server/db';

export const GET: RequestHandler = async () => {
	const db = getDb();
	const projects = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all();
	return json(projects);
};

export const POST: RequestHandler = async ({ request }) => {
	const db = getDb();
	const data = await request.json();
	const { name } = data;

	if (!name || !name.trim()) {
		return json({ error: 'Name is required' }, { status: 400 });
	}

	const id = crypto.randomUUID();
	db.prepare('INSERT INTO projects (id, name) VALUES (?, ?)').run(id, name.trim());

	const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
	return json(project, { status: 201 });
};
