import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import getDb from '$lib/server/db';

export const GET: RequestHandler = async ({ params }) => {
	const db = getDb();

	const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(params.id);
	if (!folder) return json({ error: 'Folder not found' }, { status: 404 });

	const subfolders = db.prepare('SELECT * FROM folders WHERE parent_id = ? ORDER BY name ASC').all(params.id);
	const documents = db.prepare('SELECT id, title, content, connector_id, project_id, folder_id, created_at, updated_at FROM documents WHERE folder_id = ? ORDER BY title ASC').all(params.id);

	return json({ subfolders, documents });
};
