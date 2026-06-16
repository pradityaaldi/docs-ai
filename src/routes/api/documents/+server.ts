import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, projects, documents } from '$lib/server/db';
import { eq, desc } from 'drizzle-orm';
import { snakeify } from '$lib/server/serialize';

// GET /api/documents - list documents (optional filter by project_id or folder_id)
export const GET: RequestHandler = async ({ url }) => {
	const projectId = url.searchParams.get('project_id');
	const folderId = url.searchParams.get('folder_id');

	let rows;
	if (folderId) {
		rows = await db.select().from(documents).where(eq(documents.folderId, folderId)).orderBy(desc(documents.updatedAt));
	} else if (projectId) {
		rows = await db.select().from(documents).where(eq(documents.projectId, projectId)).orderBy(desc(documents.updatedAt));
	} else {
		rows = await db.select().from(documents).orderBy(desc(documents.updatedAt));
	}
	return json(snakeify(rows));
};

// POST /api/documents - create document
export const POST: RequestHandler = async ({ request, locals }) => {
	const data = await request.json();
	const { title, content, project_id, folder_id } = data;

	const [doc] = await db
		.insert(documents)
		.values({
			title: title || 'Untitled Document',
			content: content || '',
			userId: locals.user?.id ?? null,
			projectId: project_id || null,
			folderId: folder_id || null
		})
		.returning();

	if (project_id) {
		await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, project_id));
	}

	return json(snakeify(doc), { status: 201 });
};
