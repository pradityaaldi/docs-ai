import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import getDb from '$lib/server/db';

// GET /api/documents - list all documents (optionally filter by project_id or folder_id)
export const GET: RequestHandler = async ({ url }) => {
	const db = getDb();
	const projectId = url.searchParams.get('project_id');
	const folderId = url.searchParams.get('folder_id');

	let documents;
	if (folderId) {
		documents = db.prepare('SELECT * FROM documents WHERE folder_id = ? ORDER BY updated_at DESC').all(folderId);
	} else if (projectId) {
		documents = db.prepare('SELECT * FROM documents WHERE project_id = ? ORDER BY updated_at DESC').all(projectId);
	} else {
		documents = db.prepare('SELECT * FROM documents ORDER BY updated_at DESC').all();
	}
	return json(documents);
};

// POST /api/documents - create document
export const POST: RequestHandler = async ({ request }) => {
	const db = getDb();
	const data = await request.json();
	const { title, content, connector_id, project_id, folder_id } = data;

	const id = crypto.randomUUID();
	db.prepare(
		`INSERT INTO documents (id, title, content, connector_id, project_id, folder_id) VALUES (?, ?, ?, ?, ?, ?)`
	).run(id, title || 'Untitled Document', content || '', connector_id || null, project_id || null, folder_id || null);

	if (project_id) {
		db.prepare("UPDATE projects SET updated_at=datetime('now') WHERE id=?").run(project_id);
	}

	const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
	return json(doc, { status: 201 });
};