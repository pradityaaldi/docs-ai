import { app } from '$lib/stores/app.svelte';
import { refreshTree } from './projects';

export async function loadDocuments() {
	const res = await fetch('/api/documents');
	const data = await res.json();
	app.documents = data;
	if (data.length > 0 && !app.currentDoc) {
		await selectDocument(data[0]);
	}
}

export async function selectDocument(doc: { id: string; title?: string }) {
	const res = await fetch(`/api/documents/${doc.id}`);
	if (res.ok) {
		app.currentDoc = await res.json();
	}
	const msgRes = await fetch(`/api/documents/${doc.id}/messages`);
	app.messages = await msgRes.json();
}

export async function createDocument(folderId: string | null = null) {
	if (!app.currentProject) {
		const res = await fetch('/api/documents', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title: 'New Document' })
		});
		const newDoc = await res.json();
		app.documents = [newDoc, ...app.documents];
		await selectDocument(newDoc);
		return;
	}

	const res = await fetch('/api/documents', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			title: 'New Document',
			project_id: app.currentProject.id,
			folder_id: folderId || app.navigatingFolderId || undefined
		})
	});
	const newDoc = await res.json();
	await selectDocument(newDoc);
	await refreshTree();
}

export async function saveDocument() {
	if (!app.currentDoc) return;
	await fetch(`/api/documents/${app.currentDoc.id}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ title: app.currentDoc.title, content: app.currentDoc.content })
	});
}

export async function deleteDocument(id: string) {
	await fetch(`/api/documents/${id}`, { method: 'DELETE' });
	if (app.currentDoc?.id === id) {
		app.currentDoc = null;
		app.messages = [];
	}
	if (app.sidebarView === 'project-detail') {
		await refreshTree();
		app.rootDocuments = app.rootDocuments.filter(d => d.id !== id);
		app.projectTree = removeDocFromTree(app.projectTree, id);
	} else {
		app.documents = app.documents.filter(d => d.id !== id);
	}
}

function removeDocFromTree(nodes: typeof app.projectTree, docId: string): typeof app.projectTree {
	return nodes.map(node => ({
		...node,
		documents: node.documents.filter(d => d.id !== docId),
		children: removeDocFromTree(node.children, docId)
	}));
}

export async function clearMessages() {
	if (!app.currentDoc) return;
	await fetch(`/api/documents/${app.currentDoc.id}/messages`, { method: 'DELETE' });
	app.messages = [];
	app.currentDoc = { ...app.currentDoc, content: '' };
}
