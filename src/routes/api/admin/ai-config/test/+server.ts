import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, aiConfig } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { testConnectorConnection } from '$lib/server/ai';
import { notAdmin } from '$lib/server/admin-guard';

export const POST: RequestHandler = async ({ request, locals }) => {
	const denied = notAdmin(locals);
	if (denied) return denied;
	const { id, provider, baseUrl, model, apiKey } = await request.json();

	let cfg: { provider: any; base_url: string; model_name: string; api_key: string };
	if (id) {
		const [row] = await db.select().from(aiConfig).where(eq(aiConfig.id, id));
		if (!row) return json({ success: false, error: 'Config tidak ditemukan' }, { status: 404 });
		cfg = { provider: row.provider, base_url: row.baseUrl, model_name: row.model, api_key: row.apiKey };
	} else {
		if (!provider || !model) return json({ success: false, error: 'provider & model wajib' }, { status: 400 });
		cfg = { provider, base_url: baseUrl || '', model_name: model, api_key: apiKey || '' };
	}

	const result = await testConnectorConnection(cfg);
	return json(result);
};
