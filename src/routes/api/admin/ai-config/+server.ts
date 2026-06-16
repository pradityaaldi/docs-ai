import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, aiConfig } from '$lib/server/db';
import { desc } from 'drizzle-orm';
import { snakeify } from '$lib/server/serialize';
import { notAdmin } from '$lib/server/admin-guard';

const DEFAULT_BASE: Record<string, string> = {
	openai: 'https://api.openai.com/v1',
	anthropic: 'https://api.anthropic.com',
	gemini: 'https://generativelanguage.googleapis.com'
};

export const GET: RequestHandler = async ({ locals }) => {
	const denied = notAdmin(locals);
	if (denied) return denied;
	const rows = await db.select().from(aiConfig).orderBy(desc(aiConfig.updatedAt));
	// mask api keys
	const masked = rows.map((r) => ({ ...r, apiKey: r.apiKey ? '••••' + r.apiKey.slice(-4) : '' }));
	return json(snakeify(masked));
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const denied = notAdmin(locals);
	if (denied) return denied;
	const { provider, apiKey, model, baseUrl } = await request.json();
	if (!provider || !model) return json({ error: 'provider & model wajib' }, { status: 400 });

	const [created] = await db
		.insert(aiConfig)
		.values({
			provider,
			apiKey: apiKey || '',
			model,
			baseUrl: baseUrl || DEFAULT_BASE[provider] || '',
			isActive: false,
			updatedBy: locals.user!.id
		})
		.returning();
	return json(snakeify({ ...created, apiKey: '••••' }), { status: 201 });
};
