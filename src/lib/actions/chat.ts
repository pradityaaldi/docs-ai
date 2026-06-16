import { app, setPhase } from '$lib/stores/app.svelte';
import { stripThink, extractError, stripError, cleanDocJSON } from './stream-utils';
import { refreshTree } from './projects';
import { selectDocument } from './documents';

export async function sendMessage() {
	if (!app.chatInput.trim() || !app.currentDoc || !app.aiReady || app.isLoading || app.isGenerating) return;
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
	if (!app.chatInput.trim() || !app.currentProject || !app.aiReady || app.isLoading || app.isGenerating) return;
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

// ── Single-shot template generation ──

export async function generateProjectDoc() {
	if (!app.currentProject || app.isGenerating || app.isLoading) return;
	const proj = app.currentProject;

	app.isGenerating = true;
	const controller = new AbortController();
	app.generateAbortController = controller;
	app.status.sections = [];
	app.status.activeSection = '';
	setPhase('document-connecting', 'Menyiapkan AI…');

	try {
		const res = await fetch(`/api/projects/${proj.id}/generate`, {
			method: 'POST',
			signal: controller.signal
		});
		if (!res.ok) {
			const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
			setPhase('error', 'Gagal generate', err.error || `HTTP ${res.status}`);
			return;
		}
		const reader = res.body?.getReader();
		if (!reader) { setPhase('error', 'No stream'); return; }
		const decoder = new TextDecoder();
		let buffer = '';
		let doneDocId: string | null = null;

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			let nl: number;
			while ((nl = buffer.indexOf('\n')) !== -1) {
				const line = buffer.slice(0, nl).trim();
				buffer = buffer.slice(nl + 1);
				if (!line) continue;
				let ev: any;
				try { ev = JSON.parse(line); } catch { continue; }
				if (ev.type === 'start') {
					setPhase('document-streaming', 'Menulis dokumen…');
				} else if (ev.type === 'section') {
					app.status.activeSection = ev.name;
					app.status.sections = [...app.status.sections, ev.name];
					const n = (ev.index ?? 0) + 1;
					setPhase('document-streaming', `Bagian ${n}/${ev.total}: ${ev.name}`);
				} else if (ev.type === 'done') {
					doneDocId = ev.document_id;
				} else if (ev.type === 'error') {
					setPhase('error', 'Generate gagal', ev.error || '');
					return;
				} else if (ev.type === 'aborted') {
					setPhase('aborted', 'Dihentikan.');
					return;
				}
			}
		}

		// reflect status + open the generated document
		app.currentProject = { ...proj, status: 'generated' };
		app.projects = app.projects.map((p) => (p.id === proj.id ? { ...p, status: 'generated' } : p));
		await refreshTree();
		if (doneDocId) await selectDocument({ id: doneDocId });
		setPhase('idle', '');
	} catch (e: any) {
		if (e?.name === 'AbortError') setPhase('aborted', 'Dihentikan.');
		else setPhase('error', 'Generate gagal', e?.message || String(e));
	} finally {
		app.isGenerating = false;
		app.generateAbortController = null;
	}
}

export async function stopGeneration() {
	if (app.abortController) {
		app.abortController.abort();
	}
	if (app.generateAbortController) {
		app.generateAbortController.abort();
	}
}
