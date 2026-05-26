import { app, setPhase, type Document, type ToolResultEntry } from '$lib/stores/app.svelte';
import { inlineIllustrations } from '$lib/shared/illustration';

function stripThink(text: string): string {
	let s = text.replace(/<think>[\s\S]*?<\/think>/g, '');
	s = s.replace(/<think>[\s\S]*$/, '');
	return s;
}

function extractError(raw: string): string | null {
	const idx = raw.indexOf('\n__ERROR__:');
	if (idx < 0) return null;
	return raw.slice(idx + '\n__ERROR__:'.length).trim();
}

function stripError(raw: string): string {
	const idx = raw.indexOf('\n__ERROR__:');
	return idx >= 0 ? raw.slice(0, idx) : raw;
}

export async function loadConnectors() {
	const res = await fetch('/api/connectors');
	const data = await res.json();
	app.connectors = data;
	app.activeConnector = data.find((c: any) => c.is_active) || null;
}

// ── Projects ──

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

export async function deleteProject(id: string) {
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
}

export async function openRootChat() {
	if (!app.globalConversation) return;
	app.navigatingFolderId = null;
	app.currentDoc = app.globalConversation;
	const msgRes = await fetch(`/api/documents/${app.globalConversation.id}/messages`);
	app.messages = await msgRes.json();
}

// ── Folders ──

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

async function refreshTree() {
	if (!app.currentProject) return;
	const res = await fetch(`/api/projects/${app.currentProject.id}/tree`);
	const data = await res.json();
	app.projectTree = data.tree || [];
	app.rootDocuments = data.rootDocuments || [];
}

// ── Documents ──

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

// ── Messaging & Generation ──

export async function sendMessage() {
	const active = app.connectors.find(c => c.is_active) || null;
	if (!app.chatInput.trim() || !app.currentDoc || !active || app.isLoading || app.isGenerating) return;
	const userMessage = app.chatInput;
	app.chatInput = '';

	app.status.startedAt = Date.now();
	app.status.finishedAt = null;
	app.status.sections = [];
	app.status.activeSection = '';
	app.status.bytesReceived = 0;

	app.messages = [...app.messages, { id: crypto.randomUUID(), document_id: app.currentDoc.id, role: 'user', content: userMessage, created_at: new Date().toISOString() }];

	const assistantMsgId = crypto.randomUUID();
	app.messages = [...app.messages, { id: assistantMsgId, document_id: app.currentDoc.id, role: 'assistant', content: '', created_at: new Date().toISOString() }];
	app.status.attachedMsgId = assistantMsgId;
	setPhase('connecting', 'Connecting to AI…');

	const chatController = new AbortController();
	const genController = new AbortController();
	app.abortController = chatController;
	app.generateAbortController = genController;
	app.isLoading = true;
	app.isGenerating = true;

	const chatPromise = streamChat(userMessage, assistantMsgId, chatController.signal).catch((e) => {
		console.error('[chat] failed', e);
		return { error: (e as Error).message };
	});

	const genPromise = streamGenerate(userMessage, genController.signal).catch((e) => {
		console.error('[gen] failed', e);
		return { error: (e as Error).message };
	});

	const [chatRes, genRes] = await Promise.all([chatPromise, genPromise]);

	app.isLoading = false;
	app.isGenerating = false;
	app.abortController = null;
	app.generateAbortController = null;

	const chatErr = chatRes && 'error' in chatRes ? chatRes.error : null;
	const genErr = genRes && 'error' in genRes ? genRes.error : null;
	const chatAborted = chatRes && 'aborted' in chatRes;
	const genAborted = genRes && 'aborted' in genRes;

	if (chatAborted || genAborted) {
		setPhase('aborted', 'Stopped by user.');
	} else if (chatErr || genErr) {
		setPhase('error', genErr ? 'Document generation failed' : 'Chat failed', genErr || chatErr || '');
	} else {
		setPhase('idle', '');
	}
}

export async function sendProjectMessage() {
	const active = app.connectors.find(c => c.is_active) || null;
	if (!app.chatInput.trim() || !app.currentProject || !active || app.isLoading || app.isGenerating) return;
	const userMessage = app.chatInput;
	app.chatInput = '';

	app.status.startedAt = Date.now();
	app.status.finishedAt = null;
	app.status.toolPhase = 'tools';
	app.status.toolCallsCompleted = 0;
	app.status.toolCallCurrent = '';
	app.status.toolResults = [];

	// Use global conversation for message persistence
	const convId = app.globalConversation?.id || '';
	const userMsgId = crypto.randomUUID();
	app.messages = [...app.messages, { id: userMsgId, document_id: convId, role: 'user', content: userMessage, created_at: new Date().toISOString() }];

	const assistantMsgId = crypto.randomUUID();
	app.messages = [...app.messages, { id: assistantMsgId, document_id: convId, role: 'assistant', content: '', created_at: new Date().toISOString() }];
	app.status.attachedMsgId = assistantMsgId;

	setPhase('connecting', 'Connecting to AI…');

	const controller = new AbortController();
	app.abortController = controller;
	app.isLoading = true;

	try {
		const res = await fetch('/api/chat/tools', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ project_id: app.currentProject.id, message: userMessage }),
			signal: controller.signal
		});

		if (!res.ok) {
			const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
			setPhase('error', 'Failed to start generation', err.error || `HTTP ${res.status}`);
			app.isLoading = false;
			app.abortController = null;
			return;
		}

		const reader = res.body?.getReader();
		if (!reader) {
			setPhase('error', 'No response stream');
			app.isLoading = false;
			app.abortController = null;
			return;
		}

		const decoder = new TextDecoder();
		let raw = '';

		setPhase('chat-streaming', 'Working on project…');
		app.status.lastChunkAt = Date.now();

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			const chunk = decoder.decode(value, { stream: true });
			raw += chunk;

			// Parse tool events
			const toolEventPattern = /__TOOL__:(start|done|error):(\{[^}]+\})/g;
			let match;
			while ((match = toolEventPattern.exec(raw)) !== null) {
				const [, eventType, dataStr] = match;
				try {
					const data = JSON.parse(dataStr);
					if (eventType === 'start' && data.name === 'create_document') {
						app.status.toolPhase = 'tools';
						app.status.toolCallCurrent = data.arguments?.title || '';
					} else if (eventType === 'done' && data.name === 'create_document') {
						try {
							const result = JSON.parse(data.result || '{}');
							if (result.success) {
								app.status.toolCallsCompleted++;
								app.status.toolResults = [...app.status.toolResults, {
									title: result.title || '',
									documentId: result.document_id || '',
									success: true
								}];
							} else {
								app.status.toolResults = [...app.status.toolResults, {
									title: app.status.toolCallCurrent || 'Unknown',
									documentId: '',
									success: false,
									error: result.error || 'Unknown error'
								}];
							}
						} catch {
							app.status.toolCallsCompleted++;
						}
						app.status.toolCallCurrent = '';
					} else if (eventType === 'error') {
						app.status.toolResults = [...app.status.toolResults, {
							title: app.status.toolCallCurrent || data.name || 'Unknown',
							documentId: '',
							success: false,
							error: data.error || 'Tool error'
						}];
						app.status.toolCallCurrent = '';
					}
				} catch { /* parse error — skip */ }
			}

			// Strip tool events and update visible content
			const visible = raw.replace(/__TOOL__:[^\n]*\n/g, '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();

			// Check for errors
			const errIdx = raw.indexOf('\n__ERROR__:');
			if (errIdx >= 0) {
				const errMsg = raw.slice(errIdx + '\n__ERROR__:'.length).trim();
				setPhase('error', 'Project generation failed', errMsg);
				app.isLoading = false;
				app.abortController = null;
				return;
			}

			app.messages = app.messages.map((m) =>
				m.id === assistantMsgId ? { ...m, content: visible } : m
			);

			app.status.bytesReceived = raw.length;
			app.status.lastChunkAt = Date.now();

			// Switch phase when text starts flowing
			if (visible.length > 10 && app.status.toolPhase === 'tools' && app.status.toolCallsCompleted > 0) {
				app.status.toolPhase = 'chat';
			}
		}

		// Refresh project tree to show new documents
		await refreshTree();
		setPhase('idle', '');
	} catch (e: any) {
		if (e.name === 'AbortError') {
			setPhase('aborted', 'Stopped by user.');
			await refreshTree();
		} else {
			setPhase('error', 'Request failed', e.message || String(e));
		}
	} finally {
		app.isLoading = false;
		app.abortController = null;
	}
}

async function streamChat(userMessage: string, assistantMsgId: string, signal: AbortSignal): Promise<{ ok: true } | { error: string } | { aborted: true }> {
	if (!app.currentDoc) return { error: 'No document' };
	const res = await fetch('/api/chat', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ document_id: app.currentDoc.id, message: userMessage }),
		signal
	});

	if (!res.ok) {
		const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
		return { error: err.error || `HTTP ${res.status}` };
	}

	const reader = res.body?.getReader();
	if (!reader) return { error: 'No response stream' };
	const decoder = new TextDecoder();
	let raw = '';

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			raw += decoder.decode(value, { stream: true });
			const err = extractError(raw);
			if (err) return { error: err };
			const visible = stripThink(stripError(raw)).trimStart();
			app.messages = app.messages.map((m) => (m.id === assistantMsgId ? { ...m, content: visible } : m));
		}
	} catch (e) {
		if ((e as Error).name === 'AbortError') return { aborted: true };
		throw e;
	}

	const finalErr = extractError(raw);
	if (finalErr) return { error: finalErr };
	return { ok: true };
}

async function streamGenerate(userMessage: string, signal: AbortSignal): Promise<{ ok: true } | { error: string } | { aborted: true }> {
	if (!app.currentDoc) return { error: 'No document' };
	const res = await fetch('/api/generate', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ document_id: app.currentDoc.id, message: userMessage }),
		signal
	});

	if (!res.ok) {
		const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
		return { error: err.error || `HTTP ${res.status}` };
	}

	const reader = res.body?.getReader();
	if (!reader) return { error: 'No response stream' };
	const decoder = new TextDecoder();
	let content = '';

	if (app.status.phase === 'connecting') setPhase('document-streaming', 'Generating document…');
	app.status.lastChunkAt = Date.now();

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			content += decoder.decode(value, { stream: true });
			app.status.bytesReceived = content.length;
			app.status.lastChunkAt = Date.now();
			app.status.thinking = /<think>(?![\s\S]*<\/think>)/.test(content);
			const err = extractError(content);
			if (err) return { error: err };
			const stripped = stripError(content);
			trackGenerateProgress(stripped);
			updateLivePreview(stripped);
		}
	} catch (e) {
		if ((e as Error).name === 'AbortError') {
			const refreshRes = await fetch(`/api/documents/${app.currentDoc!.id}`).catch(() => null);
			if (refreshRes?.ok) app.currentDoc = await refreshRes.json();
			return { aborted: true };
		}
		throw e;
	}

	const finalErr = extractError(content);
	if (finalErr) return { error: finalErr };

	const refreshRes = await fetch(`/api/documents/${app.currentDoc!.id}`).catch(() => null);
	if (refreshRes?.ok) app.currentDoc = await refreshRes.json();
	return { ok: true };
}

function cleanDocJSON(raw: string): string {
	let s = raw.replace(/<think>[\s\S]*?<\/think>/g, '');
	s = s.replace(/<think>[\s\S]*$/, '');
	s = s.replace(/```(?:json)?\s*/gi, '');
	s = s.replace(/```\s*$/g, '');
	const braceIdx = s.indexOf('{');
	if (braceIdx < 0) return '';
	s = s.slice(braceIdx);
	return s.trim();
}

function updateLivePreview(raw: string) {
	if (!app.currentDoc) return;
	const docContent = cleanDocJSON(raw);
	if (docContent.length < 50) return;
	if (!/"content"\s*:\s*\[\s*\{/.test(docContent)) return;
	if (app.currentDoc.content !== docContent) {
		app.currentDoc = { ...app.currentDoc, content: docContent };
	}
}

function trackGenerateProgress(content: string) {
	let cleaned = cleanDocJSON(content);
	if (!cleaned) return;
	try {
		const doc = JSON.parse(cleaned);
		if (!doc || !Array.isArray(doc.content)) return;
		const found: string[] = [];
		for (const el of doc.content) {
			if (el.type === 'heading' && el.text) found.push(el.text);
		}
		if (found.length > 0) {
			app.status.activeSection = found[found.length - 1];
			app.status.sections = found;
		}
	} catch { /* incomplete JSON during streaming */ }
}

export async function stopGeneration() {
	if (app.abortController) {
		app.abortController.abort();
	}
	if (app.generateAbortController) {
		app.generateAbortController.abort();
	}
}

export async function clearMessages() {
	if (!app.currentDoc) return;
	await fetch(`/api/documents/${app.currentDoc.id}/messages`, { method: 'DELETE' });
	app.messages = [];
	app.currentDoc = { ...app.currentDoc, content: '' };
}

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
