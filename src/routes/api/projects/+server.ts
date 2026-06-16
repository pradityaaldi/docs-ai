import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, projects } from '$lib/server/db';
import { desc, eq } from 'drizzle-orm';
import { snakeify } from '$lib/server/serialize';
import { canCreateProject } from '$lib/server/billing';

export const GET: RequestHandler = async ({ locals }) => {
	const rows = locals.user
		? await db
				.select()
				.from(projects)
				.where(eq(projects.userId, locals.user.id))
				.orderBy(desc(projects.updatedAt))
		: await db.select().from(projects).orderBy(desc(projects.updatedAt));
	return json(snakeify(rows));
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const data = await request.json();
	const { name } = data;
	if (!name || !name.trim()) {
		return json({ error: 'Name is required' }, { status: 400 });
	}
	if (locals.user) {
		const limit = await canCreateProject(locals.user.id, locals.user.role);
		if (!limit.ok) return json({ error: limit.reason }, { status: 402 });
	}
	const [project] = await db
		.insert(projects)
		.values({ name: name.trim(), userId: locals.user?.id ?? null })
		.returning();
	return json(snakeify(project), { status: 201 });
};
