import { app, setPhase, type MentionItem, type TreeNode } from '$lib/stores/app.svelte';
import { refreshTree } from './projects';
import { selectDocument } from './documents';

// Flatten the current project's tree (folders + documents) into a list the
// composer can offer as @-mention suggestions.
export function mentionItems(): MentionItem[] {
	const out: MentionItem[] = [];
	const walk = (nodes: TreeNode[]) => {
		for (const n of nodes) {
			out.push({ id: n.id, title: n.name, type: 'folder' });
			for (const d of n.documents) out.push({ id: d.id, title: d.title, type: 'file' });
			walk(n.children);
		}
	};
	walk(app.projectTree);
	for (const d of app.rootDocuments) out.push({ id: d.id, title: d.title, type: 'file' });
	return out;
}

// ── conversation multi-select (copy chunks to improve prompts) ──

export function toggleSelectMode() {
	app.selectMode = !app.selectMode;
	if (!app.selectMode) app.selectedMsgIds = [];
}

export function toggleMessageSelected(id: string) {
	app.selectedMsgIds = app.selectedMsgIds.includes(id)
		? app.selectedMsgIds.filter((x) => x !== id)
		: [...app.selectedMsgIds, id];
}

export function selectAllMessages() {
	app.selectedMsgIds = app.messages.filter((m) => m.content.trim()).map((m) => m.id);
}

export function clearSelection() {
	app.selectedMsgIds = [];
}

// Copy the selected messages as a readable transcript (in conversation order).
export async function copySelectedMessages(): Promise<boolean> {
	const chosen = new Set(app.selectedMsgIds);
	const picked = app.messages.filter((m) => chosen.has(m.id) && m.content.trim());
	if (!picked.length) return false;
	const transcript = picked
		.map((m) => `${m.role === 'user' ? 'You' : 'Assistant'}:\n${m.content.trim()}`)
		.join('\n\n---\n\n');
	try {
		await navigator.clipboard.writeText(transcript);
		return true;
	} catch {
		return false;
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

	// Capture + clear @-mentions for this send (content injected server-side).
	const mentionIds = app.mentions.map((m) => m.id);
	app.mentions = [];

	const projectId = app.currentProject.id;
	const userMsgId = crypto.randomUUID();
	app.messages = [...app.messages, { id: userMsgId, project_id: projectId, role: 'user', content: userMessage, created_at: new Date().toISOString() }];

	const assistantMsgId = crypto.randomUUID();
	app.messages = [...app.messages, { id: assistantMsgId, project_id: projectId, role: 'assistant', content: '', created_at: new Date().toISOString() }];
	app.status.attachedMsgId = assistantMsgId;

	setPhase('connecting', 'Connecting to AI…');

	const controller = new AbortController();
	app.abortController = controller;
	app.isLoading = true;

	try {
		const res = await fetch('/api/chat/tools', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ project_id: projectId, message: userMessage, mention_ids: mentionIds }),
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
		const seenToolPos = new Set<number>();
		const affectedDocIds: string[] = [];

		// Apply one tool event to status; track created/updated doc ids so we can
		// surface the result in the editor afterwards.
		const handleToolEvent = (type: string, payload: string) => {
			let data: any;
			try { data = JSON.parse(payload); } catch { return; }
			if (type === 'start') {
				app.status.toolPhase = 'tools';
				app.status.toolCallCurrent = data.label || data.name || '';
				return;
			}
			if (type === 'error') {
				app.status.toolResults = [...app.status.toolResults, { title: app.status.toolCallCurrent || data.name || 'Document', documentId: '', success: false, error: data.error || 'Tool error' }];
				app.status.toolCallCurrent = '';
				return;
			}
			// done
			let result: any = {};
			try { result = JSON.parse(data.result || '{}'); } catch {}
			if (result.success) {
				app.status.toolCallsCompleted++;
				if (result.document_id) affectedDocIds.push(result.document_id);
				app.status.toolResults = [...app.status.toolResults, { title: result.title || app.status.toolCallCurrent || 'Document', documentId: result.document_id || '', success: true }];
			} else {
				app.status.toolResults = [...app.status.toolResults, { title: app.status.toolCallCurrent || data.name || 'Document', documentId: '', success: false, error: result.error || 'Unknown error' }];
			}
			app.status.toolCallCurrent = '';
		};

		setPhase('chat-streaming', 'Working on project…');
		app.status.lastChunkAt = Date.now();

		// Match a complete tool event anywhere in the stream (terminated by \n).
		const toolRe = /__TOOL__:(start|done|error):([^\n]*)\n/g;

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			raw += decoder.decode(value, { stream: true });

			toolRe.lastIndex = 0;
			let m: RegExpExecArray | null;
			while ((m = toolRe.exec(raw)) !== null) {
				if (seenToolPos.has(m.index)) continue;
				seenToolPos.add(m.index);
				handleToolEvent(m[1], m[2]);
			}

			// Error sentinel
			const errIdx = raw.indexOf('\n__ERROR__:');
			if (errIdx >= 0) {
				const errMsg = raw.slice(errIdx + '\n__ERROR__:'.length).trim();
				setPhase('error', 'Project generation failed', errMsg);
				app.isLoading = false;
				app.abortController = null;
				return;
			}

			// Visible chat text = stream minus tool markers + reasoning.
			const visible = raw.replace(/__TOOL__:[^\n]*\n?/g, '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
			app.messages = app.messages.map((mm) => (mm.id === assistantMsgId ? { ...mm, content: visible } : mm));

			app.status.bytesReceived = raw.length;
			app.status.lastChunkAt = Date.now();
			if (visible.length > 10 && app.status.toolPhase === 'tools' && app.status.toolCallsCompleted > 0) {
				app.status.toolPhase = 'chat';
			}
		}

		// Surface the created/updated document in the editor — content lands in the
		// docx preview, not just the chat reply.
		await refreshTree();
		const lastDoc = affectedDocIds[affectedDocIds.length - 1];
		if (lastDoc) {
			app.previewTab = 'preview';
			await selectDocument({ id: lastDoc });
		} else if (app.currentDoc) {
			await selectDocument({ id: app.currentDoc.id });
		}
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
