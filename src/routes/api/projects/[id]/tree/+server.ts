import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, projects, folders, documents } from '$lib/server/db';
import { eq, asc } from 'drizzle-orm';
import { snakeify } from '$lib/server/serialize';

interface TreeNode {
	id: string;
	name: string;
	type: 'folder';
	parent_id: string | null;
	children: TreeNode[];
	documents: { id: string; title: string; updated_at: string }[];
}

export const GET: RequestHandler = async ({ params, locals }) => {
	const [project] = await db.select().from(projects).where(eq(projects.id, params.id));
	if (!project) return json({ error: 'Project not found' }, { status: 404 });
	if (project.userId && project.userId !== locals.user?.id) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const folderRows = await db
		.select()
		.from(folders)
		.where(eq(folders.projectId, params.id))
		.orderBy(asc(folders.name));
	const docRows = await db
		.select()
		.from(documents)
		.where(eq(documents.projectId, params.id))
		.orderBy(asc(documents.title));

	const folderMap = new Map<string, TreeNode>();
	const rootNodes: TreeNode[] = [];

	for (const f of folderRows) {
		folderMap.set(f.id, {
			id: f.id,
			name: f.name,
			type: 'folder',
			parent_id: f.parentId,
			children: [],
			documents: []
		});
	}

	for (const doc of docRows) {
		if (doc.folderId && folderMap.has(doc.folderId)) {
			folderMap.get(doc.folderId)!.documents.push({
				id: doc.id,
				title: doc.title,
				updated_at: doc.updatedAt.toISOString()
			});
		}
	}

	for (const [, node] of folderMap) {
		if (node.parent_id && folderMap.has(node.parent_id)) {
			folderMap.get(node.parent_id)!.children.push(node);
		} else {
			rootNodes.push(node);
		}
	}

	const rootDocuments = docRows
		.filter((d) => !d.folderId)
		.map((d) => ({ id: d.id, title: d.title, updated_at: d.updatedAt.toISOString() }));

	return json({ project: snakeify(project), tree: rootNodes, rootDocuments });
};
