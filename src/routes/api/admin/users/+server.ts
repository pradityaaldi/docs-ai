import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, users, aiGenerations } from '$lib/server/db';
import { eq, sql, desc } from 'drizzle-orm';
import { notAdmin } from '$lib/server/admin-guard';

// All users with their role + lifetime AI usage (tokens, generate count, cost).
export const GET: RequestHandler = async ({ locals }) => {
	const denied = notAdmin(locals);
	if (denied) return denied;

	const rows = await db
		.select({
			id: users.id,
			email: users.email,
			name: users.name,
			role: users.role,
			createdAt: users.createdAt,
			tokens: sql<number>`coalesce(sum(${aiGenerations.totalTokens}),0)`,
			count: sql<number>`coalesce(count(${aiGenerations.id}),0)`,
			cost: sql<number>`coalesce(sum(${aiGenerations.cost}),0)`,
			lastActive: sql<string | null>`max(${aiGenerations.createdAt})`
		})
		.from(users)
		.leftJoin(aiGenerations, eq(aiGenerations.userId, users.id))
		.groupBy(users.id)
		.orderBy(desc(sql`coalesce(sum(${aiGenerations.totalTokens}),0)`));

	return json(
		rows.map((u) => ({
			id: u.id,
			email: u.email,
			name: u.name,
			role: u.role,
			created_at: u.createdAt,
			tokens: Number(u.tokens),
			count: Number(u.count),
			cost: Number(u.cost),
			last_active: u.lastActive
		}))
	);
};
