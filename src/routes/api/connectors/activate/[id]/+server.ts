import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import getDb from '$lib/server/db';

// POST /api/connectors/activate/[id] - set connector as active
export const POST: RequestHandler = async ({ params }) => {
	const db = getDb();
	// Deactivate all
	db.prepare('UPDATE connectors SET is_active = 0').run();
	// Activate selected
	db.prepare('UPDATE connectors SET is_active = 1, updated_at=datetime(\'now\') WHERE id = ?').run(params.id);

	const connector = db.prepare('SELECT * FROM connectors WHERE id = ?').get(params.id);
	return json(connector);
};