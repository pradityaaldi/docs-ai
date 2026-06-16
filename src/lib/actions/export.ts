import { app } from '$lib/stores/app.svelte';
import { inlineIllustrations } from '$lib/shared/illustration';
import { cleanDocJSON } from './stream-utils';

async function preRenderedContent(): Promise<string | undefined> {
	const raw = app.currentDoc?.content || '';
	if (!raw || !raw.includes('"illustration"')) return undefined;
	try {
		const doc = JSON.parse(cleanDocJSON(raw));
		if (!doc || !Array.isArray(doc.content)) return undefined;
		const inlined = await inlineIllustrations(doc);
		return JSON.stringify(inlined);
	} catch (e) {
		console.warn('[export] pre-render failed, falling back to raw content', e);
		return undefined;
	}
}

export async function exportDocx() {
	if (!app.currentDoc) return;
	const content = await preRenderedContent();
	const res = await fetch('/api/export/docx', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ document_id: app.currentDoc.id, content })
	});
	const blob = await res.blob();
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `${app.currentDoc.title}.docx`;
	a.click();
	URL.revokeObjectURL(url);

	// mark project ready-to-export
	if (app.currentProject && app.currentProject.status !== 'siap export') {
		await fetch(`/api/projects/${app.currentProject.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ status: 'siap export' })
		}).catch(() => {});
		app.currentProject = { ...app.currentProject, status: 'siap export' };
		app.projects = app.projects.map((p) => (p.id === app.currentProject!.id ? { ...p, status: 'siap export' } : p));
	}
}

export async function exportPdf() {
	if (!app.currentDoc) return;
	const res = await fetch('/api/export/pdf', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ document_id: app.currentDoc.id })
	});
	const blob = await res.blob();
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `${app.currentDoc.title}.pdf`;
	a.click();
	URL.revokeObjectURL(url);
}
