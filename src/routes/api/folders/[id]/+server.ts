import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import getDb from '$lib/server/db';

export const PUT: RequestHandler = async ({ params, request }) => {
	const db = getDb();
	const data = await request.json();
	const { name, parent_id } = data;

	const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(params.id) as { project_id: string } | undefined;
	if (!folder) return json({ error: 'Not found' }, { status: 404 });

	if (name !== undefined) {
		if (!name.trim()) return json({ error: 'Name is required' }, { status: 400 });
		db.prepare('UPDATE folders SET name=? WHERE id=?').run(name.trim(), params.id);
	}

	if (parent_id !== undefined) {
		if (parent_id === params.id) return json({ error: 'Cannot move folder into itself' }, { status: 400 });
		if (parent_id !== null) {
			const parent = db.prepare('SELECT id FROM folders WHERE id = ? AND project_id = ?').get(parent_id, folder.project_id);
			if (!parent) return json({ error: 'Parent folder not found' }, { status: 404 });
		}
		db.prepare('UPDATE folders SET parent_id=? WHERE id=?').run(parent_id, params.id);
	}

	db.prepare("UPDATE projects SET updated_at=datetime('now') WHERE id=?").run(folder.project_id);

	const updated = db.prepare('SELECT * FROM folders WHERE id = ?').get(params.id);
	return json(updated);
};

export const DELETE: RequestHandler = async ({ params }) => {
	const db = getDb();

	const collectFolderIds = (folderId: string): string[] => {
		const ids: string[] = [folderId];
		const children = db.prepare('SELECT id FROM folders WHERE parent_id = ?').all(folderId) as { id: string }[];
		for (const child of children) {
			ids.push(...collectFolderIds(child.id));
		}
		return ids;
	};

	const allIds = collectFolderIds(params.id);
	const placeholders = allIds.map(() => '?').join(',');

	db.prepare(`UPDATE documents SET folder_id = NULL WHERE folder_id IN (${placeholders})`).run(...allIds);
	db.prepare(`DELETE FROM folders WHERE id IN (${placeholders})`).run(...allIds);

	return json({ success: true });
};
