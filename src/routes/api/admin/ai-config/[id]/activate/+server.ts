import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, aiConfig } from '$lib/server/db';
import { eq, ne } from 'drizzle-orm';
import { notAdmin } from '$lib/server/admin-guard';

// Set one config active; deactivate all others (single active at a time).
export const POST: RequestHandler = async ({ params, locals }) => {
	const denied = notAdmin(locals);
	if (denied) return denied;

	const [target] = await db.select().from(aiConfig).where(eq(aiConfig.id, params.id));
	if (!target) return json({ error: 'Not found' }, { status: 404 });

	await db.update(aiConfig).set({ isActive: false }).where(ne(aiConfig.id, params.id));
	await db.update(aiConfig).set({ isActive: true, updatedAt: new Date() }).where(eq(aiConfig.id, params.id));

	return json({ ok: true });
};
