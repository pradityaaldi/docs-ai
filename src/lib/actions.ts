import { app, type Document } from '$lib/stores/app.svelte';

export async function loadConnectors() {
	const res = await fetch('/api/connectors');
	const data = await res.json();
	app.connectors = data;
	app.activeConnector = data.find((c: any) => c.is_active) || null;
}

export async function loadDocuments() {
	const res = await fetch('/api/documents');
	const data = await res.json();
	app.documents = data;
	if (data.length > 0 && !app.currentDoc) {
		await selectDocument(data[0]);
	}
}

export async function selectDocument(doc: Document) {
	app.currentDoc = doc;
	const res = await fetch(`/api/documents/${doc.id}/messages`);
	app.messages = await res.json();
}

export async function createDocument() {
	const res = await fetch('/api/documents', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ title: 'New Document' })
	});
	const newDoc = await res.json();
	app.documents = [newDoc, ...app.documents];
	await selectDocument(newDoc);
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
	app.documents = app.documents.filter((d) => d.id !== id);
	if (app.currentDoc?.id === id) {
		app.currentDoc = app.documents[0] || null;
		if (app.currentDoc) await selectDocument(app.currentDoc);
		else app.messages = [];
	}
}

export async function sendMessage() {
	const active = app.connectors.find(c => c.is_active) || null;
	if (!app.chatInput.trim() || !app.currentDoc || !active || app.isLoading) return;
	const userMessage = app.chatInput;
	app.chatInput = '';
	app.isLoading = true;
	app.progressSections = [];
	app.activeSection = '';

	const controller = new AbortController();
	app.abortController = controller;

	app.messages = [...app.messages, { id: crypto.randomUUID(), document_id: app.currentDoc.id, role: 'user', content: userMessage, created_at: new Date().toISOString() }];

	try {
		const res = await fetch('/api/chat', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ document_id: app.currentDoc.id, message: userMessage }),
			signal: controller.signal
		});

		if (!res.ok) {
			const err = await res.json();
			alert(err.error || 'Error sending message');
			app.isLoading = false;
			app.progressSections = [];
			return;
		}

		const reader = res.body?.getReader();
		if (!reader) throw new Error('No response stream');
		const decoder = new TextDecoder();
		let assistantContent = '';
		const tempMsgId = crypto.randomUUID();

		app.messages = [...app.messages, { id: tempMsgId, document_id: app.currentDoc.id, role: 'assistant', content: '', created_at: new Date().toISOString() }];

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			const text = decoder.decode(value, { stream: true });
			assistantContent += text;
			app.messages = app.messages.map((m) => (m.id === tempMsgId ? { ...m, content: assistantContent } : m));
			trackProgress(assistantContent);
		}

		const refreshRes = await fetch(`/api/documents/${app.currentDoc.id}`);
		if (refreshRes.ok) app.currentDoc = await refreshRes.json();
		app.progressSections = [];
		app.activeSection = '';
	} catch (err) {
		if ((err as Error).name === 'AbortError') {
			const lastMsg = app.messages[app.messages.length - 1];
			if (lastMsg?.role === 'assistant' && lastMsg.content) {
				await fetch(`/api/documents/${app.currentDoc!.id}/messages`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ role: 'assistant', content: lastMsg.content })
				});
				await fetch(`/api/documents/${app.currentDoc!.id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ title: app.currentDoc!.title, content: lastMsg.content })
				});
				app.currentDoc = { ...app.currentDoc!, content: lastMsg.content };
			}
		} else {
			console.error(err);
			alert('Error: ' + (err as Error).message);
		}
		app.progressSections = [];
		app.activeSection = '';
	} finally {
		app.isLoading = false;
		app.abortController = null;
	}
}

function trackProgress(content: string) {
	let cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, '');
	const braceIdx = cleaned.indexOf('{');
	if (braceIdx > 0) cleaned = cleaned.slice(braceIdx);
	try {
		const doc = JSON.parse(cleaned);
		if (!doc || !Array.isArray(doc.content)) return;
		const found: string[] = [];
		for (const el of doc.content) {
			if (el.type === 'heading' && el.text) found.push(el.text);
		}
		if (found.length > 0) {
			app.activeSection = found[found.length - 1];
			app.progressSections = found;
		}
	} catch { /* incomplete JSON during streaming */ }
}

export async function stopGeneration() {
	if (app.abortController) {
		app.abortController.abort();
	}
}

export async function clearMessages() {
	if (!app.currentDoc) return;
	await fetch(`/api/documents/${app.currentDoc.id}/messages`, { method: 'DELETE' });
	app.messages = [];
	app.currentDoc = { ...app.currentDoc, content: '' };
}

export async function exportDocx() {
	if (!app.currentDoc) return;
	const res = await fetch('/api/export/docx', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ document_id: app.currentDoc.id })
	});
	const blob = await res.blob();
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `${app.currentDoc.title}.docx`;
	a.click();
	URL.revokeObjectURL(url);
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
