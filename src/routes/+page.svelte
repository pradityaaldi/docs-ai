<script lang="ts">
	import '../app.css';

	interface Connector {
		id: string;
		name: string;
		provider: string;
		base_url: string;
		model_name: string;
		api_key: string;
		is_active: number;
	}

	interface Document {
		id: string;
		title: string;
		content: string;
		connector_id: string | null;
		created_at: string;
		updated_at: string;
	}

	interface Message {
		id: string;
		document_id: string;
		role: 'user' | 'assistant';
		content: string;
		created_at: string;
	}

	let connectors = $state<Connector[]>([]);
	let documents = $state<Document[]>([]);
	let activeConnector = $state<Connector | null>(null);
	let currentDoc = $state<Document | null>(null);
	let messages = $state<Message[]>([]);
	let chatInput = $state('');
	let isLoading = $state(false);
	let abortController = $state<AbortController | null>(null);
	let progressSections = $state<string[]>([]);
	let activeSection = $state('');
	let showSettings = $state(false);
	let newConnector = $state({ name: '', provider: 'openai', base_url: '', model_name: '', api_key: '' });
	let testingConnector = $state(false);
	let testResult = $state<{ success: boolean; error?: string } | null>(null);
	let previewTab = $state<'preview' | 'code'>('preview');

	function escapeHtml(s: string): string {
		return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	}

	function renderPreview(content: string): string {
		let cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, '');
		const braceIdx = cleaned.indexOf('{');
		if (braceIdx > 0) cleaned = cleaned.slice(braceIdx);
		try {
			const doc = JSON.parse(content);
			if (!doc || !Array.isArray(doc.content)) return '';
			const pieces: string[] = [];
			for (const el of doc.content) {
				switch (el.type) {
					case 'heading': {
						const h = `h${Math.min(el.level || 1, 6)}`;
						const a = el.alignment === 'center' ? ' style="text-align:center"' : el.alignment === 'right' ? ' style="text-align:right"' : '';
						const t = (el.text || '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/`(.+?)`/g, '<code>$1</code>').replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:#3b82f6">$1</a>');
						pieces.push(`<${h}${a}>${t}</${h}>`);
						break;
					}
					case 'paragraph': {
						const a = el.alignment === 'center' ? ' style="text-align:center"' : el.alignment === 'right' ? ' style="text-align:right"' : '';
						let html = '';
						if (el.runs && Array.isArray(el.runs)) {
							html = el.runs.map((r: any) => {
								let s = escapeHtml(r.text || '');
								if (r.bold) s = `<strong>${s}</strong>`;
								if (r.italic) s = `<em>${s}</em>`;
								if (r.underline) s = `<u>${s}</u>`;
								if (r.strike) s = `<s>${s}</s>`;
								if (r.link) s = `<a href="${escapeHtml(r.link)}" style="color:#3b82f6">${s}</a>`;
								if (r.color) s = `<span style="color:#${r.color}">${s}</span>`;
								return s;
							}).join('');
						} else {
							html = (el.text || '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/`(.+?)`/g, '<code>$1</code>').replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:#3b82f6">$1</a>');
						}
						pieces.push(`<p${a}>${html}</p>`);
						break;
					}
					case 'bullet':
						pieces.push('<ul>' + (el.items || []).map((i: string) => `<li>${escapeHtml(i)}</li>`).join('') + '</ul>');
						break;
					case 'numbered':
						pieces.push('<ol>' + (el.items || []).map((i: string) => `<li>${escapeHtml(i)}</li>`).join('') + '</ol>');
						break;
					case 'table': {
						let t = '<table style="border-collapse:collapse;width:100%;margin:12px 0">';
						t += '<thead><tr>' + (el.headers || []).map((h: string) => `<th style="border:1px solid #d1d5db;padding:8px;background:#f3f4f6;text-align:left">${escapeHtml(h)}</th>`).join('') + '</tr></thead>';
						t += '<tbody>' + (el.rows || []).map((row: string[]) => '<tr>' + row.map((c, i) => `<td style="border:1px solid #d1d5db;padding:6px;text-align:${(el.alignments || [])[i] || 'left'}">${escapeHtml(c || '')}</td>`).join('') + '</tr>').join('') + '</tbody>';
						t += '</table>';
						pieces.push(t);
						break;
					}
					case 'hr':
						pieces.push('<hr style="border:none;border-top:1px solid #d1d5db;margin:16px 0">');
						break;
					case 'code':
						pieces.push(`<pre style="background:#f3f4f6;padding:12px;border-radius:4px;overflow-x:auto"><code style="font-family:monospace">${escapeHtml(el.text || '')}</code></pre>`);
						break;
					case 'quote':
						pieces.push(`<blockquote style="border-left:4px solid #3b82f6;margin:12px 0;padding:8px 16px;background:#f8fafc;color:#475569">${escapeHtml(el.text || '')}</blockquote>`);
						break;
					case 'pageBreak':
						pieces.push('<hr style="border-top:2px dashed #cbd5e1;margin:24px 0">');
						break;
					case 'toc':
						pieces.push(`<h2 style="text-align:center;color:#6b7280;margin:24px 0">${escapeHtml(el.label || 'Table of Contents')}</h2>`);
						break;
				}
			}
			return pieces.join('\n');
		} catch {
			return '';
		}
	}

	async function loadConnectors() {
		const res = await fetch('/api/connectors');
		connectors = await res.json();
		activeConnector = connectors.find((c) => c.is_active) || null;
	}

	async function loadDocuments() {
		const res = await fetch('/api/documents');
		documents = await res.json();
		if (documents.length > 0 && !currentDoc) {
			await selectDocument(documents[0]);
		}
	}

	async function selectDocument(doc: Document) {
		currentDoc = doc;
		const res = await fetch(`/api/documents/${doc.id}/messages`);
		messages = await res.json();
	}

	async function createDocument() {
		const res = await fetch('/api/documents', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title: 'New Document' })
		});
		const newDoc = await res.json();
		documents = [newDoc, ...documents];
		await selectDocument(newDoc);
	}

	async function saveDocument() {
		if (!currentDoc) return;
		await fetch(`/api/documents/${currentDoc.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title: currentDoc.title, content: currentDoc.content })
		});
	}

	async function deleteDocument(id: string) {
		await fetch(`/api/documents/${id}`, { method: 'DELETE' });
		documents = documents.filter((d) => d.id !== id);
		if (currentDoc?.id === id) {
			currentDoc = documents[0] || null;
			if (currentDoc) await selectDocument(currentDoc);
			else messages = [];
		}
	}

	async function sendMessage() {
		if (!chatInput.trim() || !currentDoc || !activeConnector || isLoading) return;
		const userMessage = chatInput;
		chatInput = '';
		isLoading = true;
		progressSections = [];
		activeSection = '';
		const controller = new AbortController();
		abortController = controller;
		messages = [...messages, { id: crypto.randomUUID(), document_id: currentDoc.id, role: 'user', content: userMessage, created_at: new Date().toISOString() }];
		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ document_id: currentDoc.id, message: userMessage }),
				signal: controller.signal
			});
			if (!res.ok) {
				const err = await res.json();
				alert(err.error || 'Error sending message');
				isLoading = false;
				progressSections = [];
				return;
			}
			const reader = res.body?.getReader();
			if (!reader) throw new Error('No response stream');
			const decoder = new TextDecoder();
			let assistantContent = '';
			const tempMsgId = crypto.randomUUID();
			messages = [...messages, { id: tempMsgId, document_id: currentDoc.id, role: 'assistant', content: '', created_at: new Date().toISOString() }];
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				const text = decoder.decode(value, { stream: true });
				assistantContent += text;
				messages = messages.map((m) => (m.id === tempMsgId ? { ...m, content: assistantContent } : m));
				trackProgress(assistantContent);
			}
			const refreshRes = await fetch(`/api/documents/${currentDoc.id}`);
			if (refreshRes.ok) currentDoc = await refreshRes.json();
			progressSections = [];
			activeSection = '';
		} catch (err) {
			if ((err as Error).name === 'AbortError') {
				const lastMsg = messages[messages.length - 1];
				if (lastMsg?.role === 'assistant' && lastMsg.content) {
					await fetch(`/api/documents/${currentDoc!.id}/messages`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ role: 'assistant', content: lastMsg.content })
					});
					await fetch(`/api/documents/${currentDoc!.id}`, {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ title: currentDoc!.title, content: lastMsg.content })
					});
					currentDoc = { ...currentDoc!, content: lastMsg.content };
				}
				progressSections = [];
				activeSection = '';
			} else {
				console.error(err);
				alert('Error: ' + (err as Error).message);
				progressSections = [];
			}
		} finally {
			isLoading = false;
			abortController = null;
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
				activeSection = found[found.length - 1];
				progressSections = found;
			}
		} catch { /* incomplete JSON during streaming */ }
	}

	async function activateConnector(id: string) {
		await fetch(`/api/connectors/activate/${id}`, { method: 'POST' });
		await loadConnectors();
	}

	async function saveConnector() {
		await fetch('/api/connectors', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(newConnector)
		});
		await loadConnectors();
		newConnector = { name: '', provider: 'openai', base_url: '', model_name: '', api_key: '' };
		showSettings = false;
	}

	async function deleteConnector(id: string) {
		await fetch(`/api/connectors/${id}`, { method: 'DELETE' });
		await loadConnectors();
	}

	async function stopGeneration() {
		if (abortController) {
			abortController.abort();
		}
	}

	async function clearMessages() {
		if (!currentDoc) return;
		await fetch(`/api/documents/${currentDoc.id}/messages`, { method: 'DELETE' });
		messages = [];
		currentDoc = { ...currentDoc, content: '' };
	}

	async function testConnector() {
		testingConnector = true;
		testResult = null;
		try {
			const res = await fetch('/api/connectors/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					provider: newConnector.provider,
					base_url: newConnector.base_url,
					model_name: newConnector.model_name,
					api_key: newConnector.api_key
				})
			});
			testResult = await res.json();
		} catch (e) {
			testResult = { success: false, error: (e as Error).message };
		} finally {
			testingConnector = false;
		}
	}

	async function exportDocx() {
		if (!currentDoc) return;
		const res = await fetch('/api/export/docx', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ document_id: currentDoc.id })
		});
		const blob = await res.blob();
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${currentDoc.title}.docx`;
		a.click();
		URL.revokeObjectURL(url);
	}

	async function exportPdf() {
		if (!currentDoc) return;
		const res = await fetch('/api/export/pdf', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ document_id: currentDoc.id })
		});
		const blob = await res.blob();
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${currentDoc.title}.pdf`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			const val = chatInput.trim();
			if (val === '/clear') {
				clearMessages();
				chatInput = '';
			} else if (val === '/stop') {
				stopGeneration();
				chatInput = '';
			} else {
				sendMessage();
			}
		}
	}

	function handleDeleteDoc(id: string) {
		deleteDocument(id);
	}

	function handleModalClick() {
		showSettings = false;
		testResult = null;
	}

	function handleModalInnerClick(e: MouseEvent) {
		e.stopPropagation();
	}

	$effect(() => {
		loadConnectors();
		loadDocuments();
	});
</script>

<div class="flex h-screen">
	<aside class="w-64 bg-[var(--bg-secondary)] border-r border-[var(--border)] flex flex-col shrink-0">
		<div class="p-4 border-b border-[var(--border)]">
			<h1 class="text-lg font-bold text-[var(--accent)]">Docs AI</h1>
		</div>
		<div class="p-3">
			<button onclick={createDocument} class="w-full py-2 px-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded text-sm font-medium transition-colors cursor-pointer">
				+ New Document
			</button>
		</div>
		<div class="flex-1 overflow-y-auto">
			{#each documents as doc (doc.id)}
				<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
				<div class="group flex items-center justify-between p-3 hover:bg-[var(--bg-tertiary)] cursor-pointer border-b border-[var(--border)] transition-colors {currentDoc?.id === doc.id ? 'bg-[var(--bg-tertiary)]' : ''}"
					 onclick={() => selectDocument(doc)} role="button" tabindex="0"
					 onkeydown={(e) => e.key === 'Enter' && selectDocument(doc)}>
					<div class="flex-1 min-w-0">
						<div class="text-sm font-medium truncate">{doc.title}</div>
						<div class="text-xs text-[var(--text-secondary)]">{new Date(doc.updated_at).toLocaleDateString()}</div>
					</div>
					<button onclick={() => handleDeleteDoc(doc.id)}
							class="opacity-0 group-hover:opacity-100 p-1 hover:text-[var(--danger)] transition-opacity cursor-pointer">
						✕
					</button>
				</div>
			{/each}
		</div>
		<div class="p-3 border-t border-[var(--border)]">
			<button onclick={() => showSettings = true} class="w-full py-2 px-3 bg-[var(--bg-tertiary)] hover:bg-[var(--border)] rounded text-sm transition-colors cursor-pointer">
				⚙️ AI Settings
			</button>
			{#if activeConnector}
				<div class="mt-2 text-xs text-[var(--text-secondary)]">
					Active: <span class="text-[var(--success)]">{activeConnector.name}</span>
				</div>
			{:else}
				<div class="mt-2 text-xs text-[var(--danger)]">No AI connector active</div>
			{/if}
		</div>
	</aside>

	<main class="flex-1 flex min-w-0">
		<div class="w-1/2 flex flex-col border-r border-[var(--border)]">
			<div class="p-4 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
				<h2 class="font-semibold">AI Chat</h2>
				{#if !activeConnector}
					<p class="text-xs text-[var(--danger)] mt-1">⚠️ No AI connector. Configure in Settings.</p>
				{/if}
			</div>
			<div class="flex-1 overflow-y-auto p-4 space-y-4">
				{#if messages.length === 0}
					<div class="text-center text-[var(--text-secondary)] py-8">
						<p>Start a conversation to generate your document.</p>
						<p class="text-sm mt-2">Example: "Write a business proposal for a tech startup"</p>
						<p class="text-xs mt-3 opacity-50">Commands: /clear to wipe chat &nbsp;|&nbsp; /stop to halt generation</p>
					</div>
				{/if}
				{#each messages as msg (msg.id)}
					<div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
						<div class="max-w-[85%] rounded-lg p-3 {msg.role === 'user' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-secondary)]'}">
							{#if msg.role === 'assistant'}
								<div class="text-sm">{@html renderPreview(msg.content)}</div>
							{:else}
								<div class="text-sm whitespace-pre-wrap">{msg.content}</div>
							{/if}
						</div>
					</div>
				{/each}
				{#if isLoading}
					<div class="flex justify-start">
						<div class="bg-[var(--bg-tertiary)] rounded-lg p-4 w-full max-w-[85%] border border-[var(--border)]">
							<div class="flex items-center gap-2 mb-2">
								<span class="w-2 h-2 bg-[var(--accent)] rounded-full animate-pulse"></span>
								<span class="text-xs text-[var(--text-secondary)] font-medium">Generating document...</span>
							</div>
							{#if activeSection}
								<div class="text-xs text-[var(--accent)] mb-2">
									✍️ {activeSection}
								</div>
							{/if}
							{#if progressSections.length > 0}
								<div class="space-y-1">
									{#each progressSections as section}
										<div class="flex items-center gap-2 text-xs {section === activeSection ? 'text-[var(--accent)] font-medium' : 'text-[var(--success)]'}">
											<span>{section === activeSection ? '○' : '✓'}</span>
											<span>{section}</span>
										</div>
									{/each}
								</div>
							{:else}
								<div class="flex gap-1">
									<span class="w-2 h-2 bg-[var(--text-secondary)] rounded-full animate-bounce"></span>
									<span class="w-2 h-2 bg-[var(--text-secondary)] rounded-full animate-bounce" style="animation-delay: 0.1s"></span>
									<span class="w-2 h-2 bg-[var(--text-secondary)] rounded-full animate-bounce" style="animation-delay: 0.2s"></span>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>
			<div class="p-4 border-t border-[var(--border)] bg-[var(--bg-secondary)]">
				<div class="flex gap-2">
					<textarea
						bind:value={chatInput}
						onkeydown={handleKeydown}
						placeholder={isLoading ? 'AI is generating... (/stop to cancel)' : 'Type your message... (Enter to send, Shift+Enter for new line)'}
						class="flex-1 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-[var(--accent)]"
						rows="2"
						disabled={!activeConnector}
					></textarea>
					{#if isLoading}
						<button
							onclick={stopGeneration}
							class="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors cursor-pointer"
						>
							⏹ Stop
						</button>
					{:else}
						<button
							onclick={sendMessage}
							disabled={!chatInput.trim() || !activeConnector}
							class="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors cursor-pointer"
						>
							Send
						</button>
					{/if}
				</div>
			</div>
		</div>

		<div class="w-1/2 flex flex-col">
			<div class="p-4 border-b border-[var(--border)] bg-[var(--bg-secondary)] flex items-center justify-between">
				{#if currentDoc}
					<input
						type="text"
						bind:value={currentDoc.title}
						onblur={saveDocument}
						class="bg-transparent border-b border-transparent hover:border-[var(--border)] focus:border-[var(--accent)] px-1 text-lg font-semibold outline-none transition-colors"
					/>
				{:else}
					<span class="text-lg font-semibold text-[var(--text-secondary)]">No document selected</span>
				{/if}
				<div class="flex gap-2">
					<div class="flex bg-[var(--bg-primary)] rounded">
						<button onclick={() => previewTab = 'preview'} class="px-3 py-1 text-xs rounded-l {previewTab === 'preview' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:text-white'} transition-colors cursor-pointer">
							Preview
						</button>
						<button onclick={() => previewTab = 'code'} class="px-3 py-1 text-xs rounded-r {previewTab === 'code' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:text-white'} transition-colors cursor-pointer">
							Code
						</button>
					</div>
					<button onclick={exportDocx} disabled={!currentDoc} class="px-3 py-1 text-sm bg-[var(--bg-tertiary)] hover:bg-[var(--border)] disabled:opacity-50 rounded transition-colors cursor-pointer">
						DOCX
					</button>
					<button onclick={exportPdf} disabled={!currentDoc} class="px-3 py-1 text-sm bg-[var(--bg-tertiary)] hover:bg-[var(--border)] disabled:opacity-50 rounded transition-colors cursor-pointer">
						PDF
					</button>
				</div>
			</div>
			<div class="flex-1 overflow-hidden">
				{#if previewTab === 'preview'}
					<div class="h-full overflow-y-auto p-6 bg-white text-gray-900">
						{#if currentDoc?.content}
							<div class="prose prose-sm max-w-none">{@html renderPreview(currentDoc.content)}</div>
						{:else}
							<div class="text-center text-gray-400 py-8">
								<p>Document preview will appear here.</p>
								<p class="text-sm mt-2">Chat with AI to generate content.</p>
							</div>
						{/if}
					</div>
				{:else}
					<div class="h-full flex flex-col bg-[var(--bg-primary)]">
						<div class="flex-1 overflow-hidden">
							{#if currentDoc}
								<textarea
									bind:value={currentDoc.content}
									onblur={saveDocument}
									class="w-full h-full bg-[var(--bg-primary)] text-[var(--text-primary)] p-4 font-mono text-sm resize-none outline-none border-none leading-relaxed"
									placeholder={'{"meta":{"font":"Arial"},"content":[...]}'}
								></textarea>
							{/if}
						</div>
						<div class="px-4 py-2 bg-[var(--bg-tertiary)] border-t border-[var(--border)] flex justify-between items-center">
							<span class="text-xs text-[var(--text-secondary)]">Docx JSON — edits auto-save on blur</span>
							<span class="text-xs text-[var(--text-secondary)]">{currentDoc?.content?.length ?? 0} chars</span>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</main>
</div>

{#if showSettings}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick={handleModalClick} role="dialog" aria-modal="true" tabindex="-1">
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="bg-[var(--bg-secondary)] rounded-lg w-[600px] max-h-[80vh] overflow-y-auto" onclick={handleModalInnerClick} role="document">
			<div class="p-4 border-b border-[var(--border)] flex justify-between items-center">
				<h2 class="text-lg font-semibold">AI Connectors</h2>
				<button onclick={() => showSettings = false} class="text-2xl cursor-pointer">&times;</button>
			</div>
			<div class="p-4 space-y-4">
				<div class="bg-[var(--bg-tertiary)] rounded-lg p-4">
					<h3 class="font-medium mb-3">Add New Connector</h3>
					<div class="space-y-3">
						<input type="text" bind:value={newConnector.name} placeholder="Connector Name" class="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-2 text-sm text-white" />
						<select bind:value={newConnector.provider} class="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-2 text-sm text-white">
							<option value="openai">OpenAI Compatible</option>
							<option value="anthropic">Anthropic Claude</option>
							<option value="gemini">Google Gemini</option>
						</select>
						<input type="text" bind:value={newConnector.base_url} placeholder="Base URL (e.g., https://api.openai.com/v1)" class="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-2 text-sm text-white" />
						<input type="text" bind:value={newConnector.model_name} placeholder="Model Name" class="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-2 text-sm text-white" />
						<input type="password" bind:value={newConnector.api_key} placeholder="API Key" class="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-2 text-sm text-white" />
						<div class="flex gap-2">
							<button onclick={testConnector} disabled={testingConnector} class="flex-1 py-2 bg-[var(--bg-primary)] hover:bg-[var(--border)] rounded font-medium cursor-pointer disabled:opacity-50">
								{#if testingConnector}Testing...{:else}🔍 Test Connection{/if}
							</button>
							<button onclick={saveConnector} class="flex-1 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded font-medium cursor-pointer">Add Connector</button>
						</div>
						{#if testResult}
							<div class="mt-2 p-2 rounded text-sm {testResult.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">
								{testResult.success ? '✅ Connection successful!' : `❌ ${testResult.error}`}
							</div>
						{/if}
					</div>
				</div>

				{#each connectors as conn (conn.id)}
					<div class="bg-[var(--bg-tertiary)] rounded-lg p-4">
						<div class="flex justify-between items-start">
							<div>
								<div class="font-medium">{conn.name}</div>
								<div class="text-xs text-[var(--text-secondary)]">{conn.provider} &bull; {conn.model_name}</div>
								<div class="text-xs text-[var(--text-secondary)]">{conn.base_url}</div>
							</div>
							<div class="flex gap-2">
								{#if conn.is_active}
									<span class="px-2 py-1 text-xs bg-[var(--success)] text-white rounded">Active</span>
								{:else}
									<button onclick={() => activateConnector(conn.id)} class="px-2 py-1 text-xs bg-[var(--bg-primary)] hover:bg-[var(--border)] rounded cursor-pointer">Activate</button>
								{/if}
								<button onclick={() => deleteConnector(conn.id)} class="px-2 py-1 text-xs text-[var(--danger)] hover:bg-red-500/20 rounded cursor-pointer">Delete</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}
