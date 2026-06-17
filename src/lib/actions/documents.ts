import { app } from '$lib/stores/app.svelte';
import { confirmAction } from '$lib/stores/confirm.svelte';
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
	// Documents are preview-only now — chat lives on the project root conversation,
	// so selecting a document must not touch app.messages.
	const res = await fetch(`/api/documents/${doc.id}`);
	if (res.ok) {
		app.currentDoc = await res.json();
	}
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
		app.renamingDocId = newDoc.id;
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
	// Drop straight into inline rename so the user names the new file (VSCode-style).
	app.renamingDocId = newDoc.id;
}

export async function renameDocument(id: string, title: string) {
	const name = title.trim();
	if (!name) return;
	const res = await fetch(`/api/documents/${id}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ title: name })
	});
	if (!res.ok) return;
	if (app.currentDoc?.id === id) app.currentDoc = { ...app.currentDoc, title: name };
	if (app.currentProject) await refreshTree();
	else app.documents = app.documents.map((d) => (d.id === id ? { ...d, title: name } : d));
}

export async function saveDocument() {
	if (!app.currentDoc) return;
	await fetch(`/api/documents/${app.currentDoc.id}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ title: app.currentDoc.title, content: app.currentDoc.content })
	});
}

export async function deleteDocument(id: string): Promise<boolean> {
	const ok = await confirmAction({
		title: 'Hapus Dokumen',
		message: 'Dokumen ini akan dihapus permanen. Lanjutkan?',
		confirmText: 'Hapus'
	});
	if (!ok) return false;
	await fetch(`/api/documents/${id}`, { method: 'DELETE' });
	if (app.currentDoc?.id === id) {
		app.currentDoc = null;
	}
	if (app.sidebarView === 'project-detail') {
		await refreshTree();
		app.rootDocuments = app.rootDocuments.filter(d => d.id !== id);
		app.projectTree = removeDocFromTree(app.projectTree, id);
	} else {
		app.documents = app.documents.filter(d => d.id !== id);
	}
	return true;
}

function removeDocFromTree(nodes: typeof app.projectTree, docId: string): typeof app.projectTree {
	return nodes.map(node => ({
		...node,
		documents: node.documents.filter(d => d.id !== docId),
		children: removeDocFromTree(node.children, docId)
	}));
}

export async function clearMessages() {
	// Clears the project root conversation (the only chat there is now).
	if (!app.globalConversation) return;
	await fetch(`/api/documents/${app.globalConversation.id}/messages`, { method: 'DELETE' });
	app.messages = [];
}
