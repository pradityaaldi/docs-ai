import { app } from '$lib/stores/app.svelte';
import { refreshTree } from './projects';

export async function createFolder(parentId: string | null = null) {
	if (!app.currentProject) return;
	const res = await fetch(`/api/projects/${app.currentProject.id}/folders`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name: 'New Folder', parent_id: parentId || undefined })
	});
	if (!res.ok) return;
	await refreshTree();
}

export async function deleteFolder(id: string) {
	await fetch(`/api/folders/${id}`, { method: 'DELETE' });
	app.expandedFolderIds.delete(id);
	await refreshTree();
}

export async function loadFolderContents(folderId: string) {
	const res = await fetch(`/api/folders/${folderId}/contents`);
	return await res.json();
}
