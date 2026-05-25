import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import getDb from '$lib/server/db';

// GET /api/connectors - list all connectors
export const GET: RequestHandler = async () => {
	const db = getDb();
	const connectors = db.prepare('SELECT * FROM connectors ORDER BY created_at DESC').all();
	return json(connectors);
};

// POST /api/connectors - create connector
export const POST: RequestHandler = async ({ request }) => {
	const db = getDb();
	const data = await request.json();
	const { name, provider, base_url, model_name, api_key } = data;

	if (!name || !provider || !base_url || !model_name) {
		return json({ error: 'Missing required fields' }, { status: 400 });
	}

	const id = crypto.randomUUID();
	db.prepare(
		`INSERT INTO connectors (id, name, provider, base_url, model_name, api_key) VALUES (?, ?, ?, ?, ?, ?)`
	).run(id, name, provider, base_url, model_name, api_key || '');

	return json({ id, name, provider, base_url, model_name, api_key: api_key || '', is_active: 0 }, { status: 201 });
};