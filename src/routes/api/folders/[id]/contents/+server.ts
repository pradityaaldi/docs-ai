import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, folders, documents } from '$lib/server/db';
import { eq, asc } from 'drizzle-orm';
import { snakeify } from '$lib/server/serialize';

export const GET: RequestHandler = async ({ params }) => {
	const [folder] = await db.select().from(folders).where(eq(folders.id, params.id));
	if (!folder) return json({ error: 'Folder not found' }, { status: 404 });

	const subfolders = await db
		.select()
		.from(folders)
		.where(eq(folders.parentId, params.id))
		.orderBy(asc(folders.name));
	const docs = await db
		.select()
		.from(documents)
		.where(eq(documents.folderId, params.id))
		.orderBy(asc(documents.title));

	return json({ subfolders: snakeify(subfolders), documents: snakeify(docs) });
};
