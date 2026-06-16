import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, projects, folders } from '$lib/server/db';
import { eq, and, isNull, asc } from 'drizzle-orm';
import { snakeify } from '$lib/server/serialize';

export const GET: RequestHandler = async ({ params }) => {
	const rows = await db
		.select()
		.from(folders)
		.where(and(eq(folders.projectId, params.projectId), isNull(folders.parentId)))
		.orderBy(asc(folders.name));
	return json(snakeify(rows));
};

export const POST: RequestHandler = async ({ params, request }) => {
	const data = await request.json();
	const { name, parent_id } = data;
	if (!name || !name.trim()) {
		return json({ error: 'Name is required' }, { status: 400 });
	}

	const [project] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, params.projectId));
	if (!project) return json({ error: 'Project not found' }, { status: 404 });

	if (parent_id) {
		const [parent] = await db
			.select({ id: folders.id })
			.from(folders)
			.where(and(eq(folders.id, parent_id), eq(folders.projectId, params.projectId)));
		if (!parent) return json({ error: 'Parent folder not found' }, { status: 404 });
	}

	const [folder] = await db
		.insert(folders)
		.values({ name: name.trim(), projectId: params.projectId, parentId: parent_id || null })
		.returning();
	await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, params.projectId));

	return json(snakeify(folder), { status: 201 });
};
