import { goto } from '$app/navigation';
import { app } from '$lib/stores/app.svelte';
import { confirmAction } from '$lib/stores/confirm.svelte';

// Refresh the current project's folder tree + root documents. Shared by folder,
// document, and chat actions — lives here because the tree belongs to a project.
export async function refreshTree() {
	if (!app.currentProject) return;
	const res = await fetch(`/api/projects/${app.currentProject.id}/tree`);
	const data = await res.json();
	app.projectTree = data.tree || [];
	app.rootDocuments = data.rootDocuments || [];
}

export async function loadProjects() {
	const res = await fetch('/api/projects');
	const data = await res.json();
	app.projects = data;
	if (data.length > 0 && !app.currentProject) {
		await enterProject(data[0]);
	}
}

export async function createProject() {
	const res = await fetch('/api/projects', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name: 'New Project' })
	});
	const project = await res.json();
	app.projects = [project, ...app.projects];
	await enterProject(project);
}

// Create a named project without entering it (list page → modal). Returns the project.
export async function createProjectNamed(name: string): Promise<typeof app.projects[0] | null> {
	const res = await fetch('/api/projects', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name: name.trim() || 'New Project' })
	});
	if (!res.ok) return null;
	const project = await res.json();
	app.projects = [project, ...app.projects];
	return project;
}

export async function deleteProject(id: string) {
	const ok = await confirmAction({
		title: 'Hapus Project',
		message: 'Project beserta semua dokumen di dalamnya akan dihapus permanen. Lanjutkan?',
		confirmText: 'Hapus'
	});
	if (!ok) return;
	await fetch(`/api/projects/${id}`, { method: 'DELETE' });
	app.projects = app.projects.filter(p => p.id !== id);
	if (app.currentProject?.id === id) {
		app.currentProject = app.projects[0] || null;
		app.sidebarView = 'projects';
		if (app.currentProject) {
			await enterProject(app.currentProject);
		} else {
			app.projectTree = [];
			app.rootDocuments = [];
		}
	}
}

export async function enterProject(project: typeof app.projects[0]) {
	app.currentProject = project;
	app.currentDoc = null;
	app.messages = [];
	app.sidebarView = 'project-detail';
	app.expandedFolderIds = new Set();
	app.navigatingFolderId = null;

	const res = await fetch(`/api/projects/${project.id}/tree`);
	const data = await res.json();
	app.projectTree = data.tree || [];
	app.rootDocuments = data.rootDocuments || [];

	await loadGlobalConversation();
}

export async function loadGlobalConversation() {
	// Find the global Conversation document
	const res = await fetch('/api/documents');
	const docs = await res.json();
	const conv = docs.find((d: any) => d.title === 'Conversation' && !d.project_id);
	if (conv) {
		app.globalConversation = conv;
		const msgRes = await fetch(`/api/documents/${conv.id}/messages`);
		app.messages = await msgRes.json();
	}
}

export function exitToProjects() {
	app.currentProject = null;
	app.currentDoc = null;
	app.messages = [];
	app.globalConversation = null;
	app.projectTree = [];
	app.rootDocuments = [];
	app.sidebarView = 'projects';
	app.expandedFolderIds = new Set();
	app.navigatingFolderId = null;
	goto('/app');
}
