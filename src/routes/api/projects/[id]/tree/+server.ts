import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import getDb from '$lib/server/db';

interface FolderRow {
	id: string;
	name: string;
	project_id: string;
	parent_id: string | null;
	created_at: string;
}

interface DocRow {
	id: string;
	title: string;
	content: string;
	connector_id: string | null;
	project_id: string | null;
	folder_id: string | null;
	created_at: string;
	updated_at: string;
}

interface TreeNode {
	id: string;
	name: string;
	type: 'folder';
	parent_id: string | null;
	children: TreeNode[];
	documents?: { id: string; title: string; updated_at: string }[];
}

export const GET: RequestHandler = async ({ params }) => {
	const db = getDb();

	const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(params.id);
	if (!project) return json({ error: 'Project not found' }, { status: 404 });

	const folders = db.prepare('SELECT * FROM folders WHERE project_id = ? ORDER BY name ASC').all(params.id) as FolderRow[];
	const documents = db.prepare('SELECT * FROM documents WHERE project_id = ? ORDER BY title ASC').all(params.id) as DocRow[];

	const folderMap = new Map<string, TreeNode>();
	const rootNodes: TreeNode[] = [];

	for (const f of folders) {
		folderMap.set(f.id, {
			id: f.id,
			name: f.name,
			type: 'folder',
			parent_id: f.parent_id,
			children: [],
			documents: []
		});
	}

	for (const doc of documents) {
		if (doc.folder_id && folderMap.has(doc.folder_id)) {
			folderMap.get(doc.folder_id)!.documents!.push({
				id: doc.id,
				title: doc.title,
				updated_at: doc.updated_at
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

	const rootDocuments = documents
		.filter(d => !d.folder_id)
		.map(d => ({ id: d.id, title: d.title, updated_at: d.updated_at }));

	return json({
		project,
		tree: rootNodes,
		rootDocuments
	});
};
