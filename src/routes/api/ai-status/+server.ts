import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, aiConfig } from '$lib/server/db';
import { eq } from 'drizzle-orm';

// Lightweight check: is an admin AI config active? (replaces user connector list)
export const GET: RequestHandler = async () => {
	const [cfg] = await db.select().from(aiConfig).where(eq(aiConfig.isActive, true)).limit(1);
	return json({ ready: !!cfg, provider: cfg?.provider ?? null, model: cfg?.model ?? null });
};
