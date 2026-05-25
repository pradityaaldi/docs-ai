import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import getDb from '$lib/server/db';

// PUT /api/connectors/[id] - update connector
export const PUT: RequestHandler = async ({ params, request }) => {
	const db = getDb();
	const data = await request.json();
	const { name, provider, base_url, model_name, api_key } = data;

	db.prepare(
		`UPDATE connectors SET name=?, provider=?, base_url=?, model_name=?, api_key=?, updated_at=datetime('now') WHERE id=?`
	).run(name, provider, base_url, model_name, api_key, params.id);

	const updated = db.prepare('SELECT * FROM connectors WHERE id = ?').get(params.id);
	return json(updated);
};

// DELETE /api/connectors/[id] - delete connector
export const DELETE: RequestHandler = async ({ params }) => {
	const db = getDb();
	db.prepare('DELETE FROM connectors WHERE id = ?').run(params.id);
	return json({ success: true });
};