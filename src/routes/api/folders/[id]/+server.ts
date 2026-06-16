import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, projects, folders, documents } from '$lib/server/db';
import { eq, and, inArray } from 'drizzle-orm';
import { snakeify } from '$lib/server/serialize';

export const PUT: RequestHandler = async ({ params, request }) => {
	const data = await request.json();
	const { name, parent_id } = data;

	const [folder] = await db.select().from(folders).where(eq(folders.id, params.id));
	if (!folder) return json({ error: 'Not found' }, { status: 404 });

	if (name !== undefined) {
		if (!name.trim()) return json({ error: 'Name is required' }, { status: 400 });
		await db.update(folders).set({ name: name.trim() }).where(eq(folders.id, params.id));
	}

	if (parent_id !== undefined) {
		if (parent_id === params.id) return json({ error: 'Cannot move folder into itself' }, { status: 400 });
		if (parent_id !== null) {
			const [parent] = await db
				.select({ id: folders.id })
				.from(folders)
				.where(and(eq(folders.id, parent_id), eq(folders.projectId, folder.projectId)));
			if (!parent) return json({ error: 'Parent folder not found' }, { status: 404 });
		}
		await db.update(folders).set({ parentId: parent_id }).where(eq(folders.id, params.id));
	}

	await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, folder.projectId));

	const [updated] = await db.select().from(folders).where(eq(folders.id, params.id));
	return json(snakeify(updated));
};

export const DELETE: RequestHandler = async ({ params }) => {
	// collect this folder + all descendants
	const all = await db.select({ id: folders.id, parentId: folders.parentId }).from(folders);
	const childrenOf = new Map<string, string[]>();
	for (const f of all) {
		if (f.parentId) {
			if (!childrenOf.has(f.parentId)) childrenOf.set(f.parentId, []);
			childrenOf.get(f.parentId)!.push(f.id);
		}
	}
	const ids: string[] = [];
	const stack = [params.id];
	while (stack.length) {
		const cur = stack.pop()!;
		ids.push(cur);
		stack.push(...(childrenOf.get(cur) ?? []));
	}

	await db.update(documents).set({ folderId: null }).where(inArray(documents.folderId, ids));
	await db.delete(folders).where(inArray(folders.id, ids));

	return json({ success: true });
};
