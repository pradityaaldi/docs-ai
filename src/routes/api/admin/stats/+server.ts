import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, aiGenerations, users } from '$lib/server/db';
import { eq, gte, sql, desc } from 'drizzle-orm';
import { notAdmin } from '$lib/server/admin-guard';

export const GET: RequestHandler = async ({ locals }) => {
	const denied = notAdmin(locals);
	if (denied) return denied;

	const day = new Date(); day.setHours(0, 0, 0, 0);
	const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);

	const [today] = await db
		.select({
			tokens: sql<number>`coalesce(sum(${aiGenerations.totalTokens}),0)`,
			cost: sql<number>`coalesce(sum(${aiGenerations.cost}),0)`,
			count: sql<number>`count(*)`
		})
		.from(aiGenerations)
		.where(gte(aiGenerations.createdAt, day));

	const [monthAgg] = await db
		.select({
			tokens: sql<number>`coalesce(sum(${aiGenerations.totalTokens}),0)`,
			cost: sql<number>`coalesce(sum(${aiGenerations.cost}),0)`,
			count: sql<number>`count(*)`,
			errors: sql<number>`coalesce(sum(case when ${aiGenerations.status}='error' then 1 else 0 end),0)`,
			avgLatency: sql<number>`coalesce(avg(${aiGenerations.latencyMs}),0)`
		})
		.from(aiGenerations)
		.where(gte(aiGenerations.createdAt, month));

	const byCategory = await db
		.select({ category: aiGenerations.category, count: sql<number>`count(*)` })
		.from(aiGenerations)
		.where(gte(aiGenerations.createdAt, month))
		.groupBy(aiGenerations.category);

	const topUsers = await db
		.select({
			email: users.email,
			tokens: sql<number>`coalesce(sum(${aiGenerations.totalTokens}),0)`,
			count: sql<number>`count(*)`
		})
		.from(aiGenerations)
		.innerJoin(users, eq(users.id, aiGenerations.userId))
		.where(gte(aiGenerations.createdAt, month))
		.groupBy(users.email)
		.orderBy(desc(sql`coalesce(sum(${aiGenerations.totalTokens}),0)`))
		.limit(10);

	const mc = Number(monthAgg.count);
	return json({
		today: { tokens: Number(today.tokens), cost: Number(today.cost), count: Number(today.count) },
		month: {
			tokens: Number(monthAgg.tokens),
			cost: Number(monthAgg.cost),
			count: mc,
			errors: Number(monthAgg.errors),
			errorRate: mc > 0 ? Number(monthAgg.errors) / mc : 0,
			avgLatencyMs: Math.round(Number(monthAgg.avgLatency))
		},
		byCategory: byCategory.map((c) => ({ category: c.category, count: Number(c.count) })),
		topUsers: topUsers.map((u) => ({ email: u.email, tokens: Number(u.tokens), count: Number(u.count) }))
	});
};
