import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, projects, documents } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { snakeify } from '$lib/server/serialize';

// Owned projects are only accessible by their owner; null-owned (legacy) stay open.
function denied(project: { userId: string | null }, userId?: string) {
	return project.userId && project.userId !== userId;
}

export const GET: RequestHandler = async ({ params, locals }) => {
	const [project] = await db.select().from(projects).where(eq(projects.id, params.id));
	if (!project) return json({ error: 'Not found' }, { status: 404 });
	if (denied(project, locals.user?.id)) return json({ error: 'Forbidden' }, { status: 403 });
	return json(snakeify(project));
};

const STATUSES = ['belum mulai', 'generated', 'siap export'] as const;

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const data = await request.json();
	const { name, status } = data;

	const [project] = await db.select().from(projects).where(eq(projects.id, params.id));
	if (!project) return json({ error: 'Not found' }, { status: 404 });
	if (denied(project, locals.user?.id)) return json({ error: 'Forbidden' }, { status: 403 });

	const patch: { name?: string; status?: (typeof STATUSES)[number]; updatedAt: Date } = { updatedAt: new Date() };
	if (name !== undefined) {
		if (!name.trim()) return json({ error: 'Name is required' }, { status: 400 });
		patch.name = name.trim();
	}
	if (status !== undefined) {
		if (!STATUSES.includes(status)) return json({ error: 'Invalid status' }, { status: 400 });
		patch.status = status;
	}

	const [updated] = await db.update(projects).set(patch).where(eq(projects.id, params.id)).returning();
	return json(snakeify(updated));
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const [project] = await db.select().from(projects).where(eq(projects.id, params.id));
	if (!project) return json({ success: true });
	if (denied(project, locals.user?.id)) return json({ error: 'Forbidden' }, { status: 403 });

	// documents.project_id is SET NULL on cascade, so delete docs explicitly
	// (their messages cascade). Folders cascade with the project.
	await db.delete(documents).where(eq(documents.projectId, params.id));
	await db.delete(projects).where(eq(projects.id, params.id));
	return json({ success: true });
};
