import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, aiConfig } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { snakeify } from '$lib/server/serialize';
import { notAdmin } from '$lib/server/admin-guard';

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const denied = notAdmin(locals);
	if (denied) return denied;
	const { provider, apiKey, model, baseUrl } = await request.json();

	const patch: Record<string, unknown> = { updatedAt: new Date(), updatedBy: locals.user!.id };
	if (provider) patch.provider = provider;
	if (model) patch.model = model;
	if (baseUrl !== undefined) patch.baseUrl = baseUrl;
	// only overwrite key if a real (non-masked) value is provided
	if (apiKey && !apiKey.startsWith('••••')) patch.apiKey = apiKey;

	const [updated] = await db.update(aiConfig).set(patch).where(eq(aiConfig.id, params.id)).returning();
	if (!updated) return json({ error: 'Not found' }, { status: 404 });
	return json(snakeify({ ...updated, apiKey: '••••' }));
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const denied = notAdmin(locals);
	if (denied) return denied;
	await db.delete(aiConfig).where(eq(aiConfig.id, params.id));
	return json({ success: true });
};
