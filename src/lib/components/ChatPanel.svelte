<script lang="ts">
	import { app } from '$lib/stores/app.svelte';
	import { sendMessage, stopGeneration, clearMessages } from '$lib/actions';

	let scrollContainer = $state<HTMLDivElement>();
	let autoScroll = $state(true);
	let showScrollButton = $state(false);
	let textareaRef = $state<HTMLTextAreaElement>();

	$effect(() => {
		if (!app.chatInput && textareaRef) {
			textareaRef.style.height = 'auto';
		}
	});

	function handleScroll() {
		const el = scrollContainer;
		if (!el) return;
		const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
		autoScroll = atBottom;
		showScrollButton = !atBottom;
	}

	function scrollToBottom(smooth = true) {
		const el = scrollContainer;
		if (!el) return;
		el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
		autoScroll = true;
		showScrollButton = false;
	}

	$effect(() => {
		const msgs = app.messages;
		const loading = app.isLoading;
		if (autoScroll) {
			tick().then(() => scrollToBottom(msgs.length <= 1));
		}
	});

	async function tick() {
		await new Promise(r => requestAnimationFrame(r));
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			const val = app.chatInput.trim();
			if (val === '/clear') {
				clearMessages();
				app.chatInput = '';
			} else if (val === '/stop') {
				stopGeneration();
				app.chatInput = '';
			} else {
				sendMessage();
			}
		}
	}

	function escapeHtml(s: string): string {
		return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	}

	function renderPreview(content: string): string {
		let cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, '');
		const braceIdx = cleaned.indexOf('{');
		if (braceIdx > 0) cleaned = cleaned.slice(braceIdx);
		try {
			const doc = JSON.parse(cleaned);
			if (!doc || !Array.isArray(doc.content)) return '';
			const meta = doc.meta || {};
			const font = meta.font || 'Arial';
			const fs = meta.fontSize || 22;
			const bodySize = Math.round(fs / 2 * 100) / 100;
			const headingSizes: Record<number, number> = { 1: 1.6, 2: 1.3, 3: 1.15, 4: 1, 5: 0.9 };

			const pieces: string[] = [`<div style="font-family:${font},sans-serif;font-size:${bodySize}pt;line-height:1.6;color:var(--fg-base)">`];
			for (const el of doc.content) {
				switch (el.type) {
					case 'heading': {
						const lvl = Math.min(el.level || 1, 5);
						const sz = Math.round(bodySize * headingSizes[lvl] * 10) / 10;
						const a = el.alignment === 'center' ? 'text-align:center;' : el.alignment === 'right' ? 'text-align:right;' : '';
						const t = (el.text || '').replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--fg-base)">$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/`(.+?)`/g, '<code style="background:rgba(255,255,255,0.08);padding:2px 5px;border-radius:3px;font-family:monospace;color:#f87171">$1</code>').replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:#60a5fa">$1</a>');
						pieces.push(`<h${lvl} style="font-size:${sz}pt;font-weight:700;color:var(--fg-base);margin:${lvl===1?'20px':'14px'} 0 6px 0;${a}">${t}</h${lvl}>`);
						break;
					}
					case 'paragraph': {
						const a = el.alignment === 'center' ? 'text-align:center;' : el.alignment === 'right' ? 'text-align:right;' : '';
						let html = '';
						if (el.runs && Array.isArray(el.runs)) {
							html = (el.runs as any[]).map((r: any) => {
								let s = escapeHtml(r.text || '');
								if (r.bold) s = `<strong>${s}</strong>`;
								if (r.italic) s = `<em>${s}</em>`;
								if (r.underline) s = `<u>${s}</u>`;
								if (r.strike) s = `<s>${s}</s>`;
								if (r.link) s = `<a href="${escapeHtml(r.link)}" style="color:#60a5fa">${s}</a>`;
								if (r.color) s = `<span style="color:#${r.color}">${s}</span>`;
								return s;
							}).join('');
						} else {
							html = (el.text || '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/`(.+?)`/g, `<code style="font-family:monospace;font-size:${bodySize-0.5}pt;color:#f87171;background:rgba(255,255,255,0.08);padding:2px 5px;border-radius:3px">$1</code>`).replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:#60a5fa">$1</a>');
						}
						pieces.push(`<p style="margin:6px 0;color:var(--fg-subtle);${a}">${html}</p>`);
						break;
					}
					case 'bullet':
						pieces.push('<ul style="margin:8px 0;padding-left:24px;color:var(--fg-subtle)">' + (el.items || []).map((i: string) => `<li style="margin:2px 0">${escapeHtml(i)}</li>`).join('') + '</ul>');
						break;
					case 'numbered':
						pieces.push('<ol style="margin:8px 0;padding-left:24px;color:var(--fg-subtle)">' + (el.items || []).map((i: string) => `<li style="margin:2px 0">${escapeHtml(i)}</li>`).join('') + '</ol>');
						break;
					case 'table': {
						let t = `<table style="border-collapse:collapse;width:100%;margin:12px 0;font-size:${Math.round((bodySize-1)*10)/10}pt;color:var(--fg-subtle)">`;
						t += '<thead><tr>' + (el.headers || []).map((h: string) => `<th style="border:1px solid var(--border-base);padding:6px 8px;background:rgba(255,255,255,0.04);font-weight:600;text-align:left;color:var(--fg-base)">${escapeHtml(h)}</th>`).join('') + '</tr></thead>';
						t += '<tbody>' + (el.rows || []).map((row: string[]) => '<tr>' + row.map((c, i) => `<td style="border:1px solid var(--border-base);padding:5px 8px;text-align:${(el.alignments || [])[i] || 'left'}">${escapeHtml(c || '')}</td>`).join('') + '</tr>').join('') + '</tbody>';
						t += '</table>';
						pieces.push(t);
						break;
					}
					case 'hr':
						pieces.push('<hr style="border:none;border-top:1px solid var(--border-base);margin:14px 0">');
						break;
					case 'code':
						pieces.push(`<pre style="background:rgba(255,255,255,0.04);padding:10px 12px;border-radius:6px;overflow-x:auto;font-family:monospace;font-size:${bodySize-0.5}pt;color:var(--fg-subtle);margin:8px 0;border:1px solid var(--border-base)">${escapeHtml(el.text || '')}</pre>`);
						break;
					case 'quote':
						pieces.push(`<blockquote style="border-left:3px solid #60a5fa;margin:12px 0;padding:6px 14px;color:var(--fg-muted);font-style:italic">${escapeHtml(el.text || '')}</blockquote>`);
						break;
					case 'pageBreak':
						pieces.push('<hr style="border-top:2px dashed var(--border-strong);margin:24px 0">');
						break;
					case 'toc':
						pieces.push(`<h2 style="text-align:center;color:var(--fg-muted);font-size:${Math.round(bodySize*1.3*10)/10}pt;margin:24px 0">${escapeHtml(el.label || 'Table of Contents')}</h2>`);
						break;
				}
			}
			pieces.push('</div>');
			return pieces.join('\n');
		} catch {
			return '';
		}
	}

	// Re-run auto-scroll each time content changes
	let _msgsLen = $derived(app.messages.length);
	let _loading = $derived(app.isLoading);
	$effect(() => {
		_msgsLen; _loading;
		if (autoScroll) {
			tick().then(() => scrollToBottom(_msgsLen <= 1));
		}
	});
</script>

<div class="w-1/2 flex flex-col border-r border-[var(--border-base)]">
	<div class="h-[45px] px-4 border-b border-[var(--border-base)] flex items-center justify-between shrink-0">
		<div class="flex items-center gap-2">
			<h2 class="text-xs font-medium text-[var(--fg-subtle)] uppercase tracking-wide">Chat</h2>
			{#if !app.activeConnector}
				<span class="text-[10px] text-[var(--fg-error)]">No connector</span>
			{/if}
		</div>
	</div>

	<div class="flex-1 overflow-y-auto px-4 py-4 space-y-5 relative" bind:this={scrollContainer} onscroll={handleScroll}>
		{#if app.messages.length === 0 && !app.isLoading}
			<div class="flex flex-col items-center justify-center h-full text-center px-6">
				<div class="w-12 h-12 rounded-xl bg-[var(--bg-component)] border border-[var(--border-base)] flex items-center justify-center mb-4">
					<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 8v4l3 3" stroke="var(--fg-interactive)" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="12" r="9" stroke="var(--fg-interactive)" stroke-width="1.5"/></svg>
				</div>
				<p class="text-sm font-medium text-[var(--fg-subtle)]">Start a conversation</p>
				<p class="text-xs text-[var(--fg-muted)] mt-1 max-w-[280px] leading-relaxed">Chat with AI to generate structured documents. Try asking for a business proposal, report, or letter.</p>
				<div class="flex items-center gap-2 mt-4">
					<kbd class="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-component)] border border-[var(--border-base)] text-[var(--fg-muted)]">/clear to reset</kbd>
					<kbd class="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-component)] border border-[var(--border-base)] text-[var(--fg-muted)]">/stop to cancel</kbd>
				</div>
			</div>
		{/if}

		{#each app.messages as msg (msg.id)}
			<div class="flex flex-col {msg.role === 'user' ? 'items-end' : 'items-start'} gap-1">
				<span class="text-[10px] font-medium text-[var(--fg-muted)] uppercase tracking-wider px-1">{msg.role === 'user' ? 'You' : 'Assistant'}</span>
				<div class="max-w-[85%] {msg.role === 'user' ? 'bg-[var(--fg-interactive)] text-[var(--fg-on-color)] rounded-2xl rounded-br-sm' : 'bg-[var(--bg-component)] text-[var(--fg-base)] border border-[var(--border-base)] rounded-2xl rounded-bl-sm'} px-4 py-2.5">
					{#if msg.role === 'assistant'}
						<div class="text-sm leading-relaxed chat-content">{@html renderPreview(msg.content)}</div>
					{:else}
						<div class="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
					{/if}
				</div>
			</div>
		{/each}

		{#if app.isLoading}
			<div class="flex flex-col items-start gap-1">
				<span class="text-[10px] font-medium text-[var(--fg-muted)] uppercase tracking-wider px-1">Assistant</span>
				<div class="bg-[var(--bg-component)] border border-[var(--border-base)] rounded-2xl rounded-bl-sm px-4 py-3 max-w-[85%]">
					<div class="flex items-center gap-2 mb-2.5">
						<span class="w-1.5 h-1.5 rounded-full bg-[var(--fg-interactive)] animate-pulse"></span>
						<span class="text-xs text-[var(--fg-subtle)]">Generating...</span>
					</div>
					{#if app.activeSection}
						<div class="text-xs text-[var(--fg-interactive-hover)] mb-2">
							Writing: {app.activeSection}
						</div>
					{/if}
					{#if app.progressSections.length > 0}
						<div class="space-y-1">
							{#each app.progressSections as section}
								<div class="flex items-center gap-2 text-xs {section === app.activeSection ? 'text-[var(--fg-interactive)] font-medium' : 'text-[var(--tag-green-text)]'}">
									<span>{section === app.activeSection ? '○' : '✓'}</span>
									<span>{section}</span>
								</div>
							{/each}
						</div>
					{:else}
						<div class="flex gap-1">
							<span class="w-1 h-1 rounded-full bg-[var(--fg-muted)] animate-bounce"></span>
							<span class="w-1 h-1 rounded-full bg-[var(--fg-muted)] animate-bounce" style="animation-delay: 0.1s"></span>
							<span class="w-1 h-1 rounded-full bg-[var(--fg-muted)] animate-bounce" style="animation-delay: 0.2s"></span>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		{#if showScrollButton}
			<button
				onclick={() => scrollToBottom()}
				class="sticky bottom-0 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-[var(--bg-component)] border border-[var(--border-base)] shadow-lg flex items-center justify-center hover:bg-[var(--bg-component-hover)] transition-colors cursor-pointer z-10"
				title="Scroll to bottom"
			>
				<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 3v8M3 7l4 4 4-4" stroke="var(--fg-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
			</button>
		{/if}
	</div>

	<div class="border-t border-[var(--border-base)] bg-[var(--bg-subtle)]">
		<div class="flex items-center gap-2 p-3">
			<textarea
				bind:this={textareaRef}
				bind:value={app.chatInput}
				onkeydown={handleKeydown}
				oninput={(e) => {
					const t = e.currentTarget;
					t.style.height = 'auto';
					t.style.height = Math.min(t.scrollHeight, 160) + 'px';
				}}
				placeholder={app.isLoading ? 'AI is generating...' : app.currentDoc ? 'Type a message...' : 'Open a document to start'}
				class="flex-1 bg-[var(--bg-field)] border border-[var(--border-base)] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--border-interactive)] focus:ring-1 focus:ring-[var(--border-interactive)] transition-all placeholder-[var(--fg-disabled)] text-[var(--fg-base)]"
				rows="1"
				disabled={!app.activeConnector || !app.currentDoc}
			></textarea>
			<div class="flex items-center gap-1.5">
				{#if app.isLoading}
					<button
						onclick={stopGeneration}
						class="shrink-0 px-3 py-2 bg-[var(--button-danger)] hover:bg-[var(--button-danger-hover)] rounded-lg text-sm font-medium transition-colors cursor-pointer text-[var(--fg-on-color)]"
					>
						Stop
					</button>
				{:else}
					<button
						onclick={sendMessage}
						disabled={!app.chatInput.trim() || !app.activeConnector || !app.currentDoc}
						class="shrink-0 px-3 py-2 bg-[var(--fg-interactive)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors cursor-pointer text-[var(--fg-on-color)]"
					>
						Send
					</button>
				{/if}
			</div>
		</div>
	</div>
</div>
