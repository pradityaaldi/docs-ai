<script lang="ts">
	import { app } from '$lib/stores/app.svelte';
	import { sendMessage, stopGeneration, clearMessages } from '$lib/actions';

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
			const headingColors: Record<number, string> = { 1: '#1e293b', 2: '#1e293b', 3: '#334155', 4: '#475569', 5: '#64748b' };

			const pieces: string[] = [`<div style="font-family:${font},sans-serif;font-size:${bodySize}pt;line-height:1.5;color:#1e293b">`];
			for (const el of doc.content) {
				switch (el.type) {
					case 'heading': {
						const lvl = Math.min(el.level || 1, 5);
						const sz = Math.round(bodySize * headingSizes[lvl] * 10) / 10;
						const clr = headingColors[lvl] || '#1e293b';
						const a = el.alignment === 'center' ? 'text-align:center;' : el.alignment === 'right' ? 'text-align:right;' : '';
						const t = (el.text || '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/`(.+?)`/g, '<code>$1</code>').replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:#3b82f6">$1</a>');
						pieces.push(`<h${lvl} style="font-size:${sz}pt;font-weight:700;color:${clr};margin:${lvl===1?'24px':'16px'} 0 8px 0;${a}">${t}</h${lvl}>`);
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
								if (r.link) s = `<a href="${escapeHtml(r.link)}" style="color:#3b82f6">${s}</a>`;
								if (r.color) s = `<span style="color:#${r.color}">${s}</span>`;
								return s;
							}).join('');
						} else {
							html = (el.text || '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/`(.+?)`/g, `<code style="font-family:'Courier New',monospace;font-size:${bodySize-0.5}pt;color:#dc2626">$1</code>`).replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:#3b82f6">$1</a>');
						}
						pieces.push(`<p style="margin:6px 0;${a}">${html}</p>`);
						break;
					}
					case 'bullet':
						pieces.push('<ul style="margin:8px 0;padding-left:24px">' + (el.items || []).map((i: string) => `<li style="margin:2px 0">${escapeHtml(i)}</li>`).join('') + '</ul>');
						break;
					case 'numbered':
						pieces.push('<ol style="margin:8px 0;padding-left:24px">' + (el.items || []).map((i: string) => `<li style="margin:2px 0">${escapeHtml(i)}</li>`).join('') + '</ol>');
						break;
					case 'table': {
						let t = `<table style="border-collapse:collapse;width:100%;margin:12px 0;font-size:${Math.round((bodySize-1)*10)/10}pt">`;
						t += '<thead><tr>' + (el.headers || []).map((h: string) => `<th style="border:1px solid #d1d5db;padding:8px;background:#f3f4f6;font-weight:700;text-align:left;color:#1e293b">${escapeHtml(h)}</th>`).join('') + '</tr></thead>';
						t += '<tbody>' + (el.rows || []).map((row: string[]) => '<tr>' + row.map((c, i) => `<td style="border:1px solid #d1d5db;padding:6px;text-align:${(el.alignments || [])[i] || 'left'}">${escapeHtml(c || '')}</td>`).join('') + '</tr>').join('') + '</tbody>';
						t += '</table>';
						pieces.push(t);
						break;
					}
					case 'hr':
						pieces.push('<hr style="border:none;border-top:1px solid #d1d5db;margin:16px 0">');
						break;
					case 'code':
						pieces.push(`<pre style="background:#f3f4f6;padding:12px;border-radius:4px;overflow-x:auto;font-family:'Courier New',monospace;font-size:${bodySize-0.5}pt;color:#374151;margin:8px 0">${escapeHtml(el.text || '')}</pre>`);
						break;
					case 'quote':
						pieces.push(`<blockquote style="border-left:4px solid #3b82f6;margin:12px 0;padding:8px 16px;background:#f8fafc;color:#475569;font-style:italic">${escapeHtml(el.text || '')}</blockquote>`);
						break;
					case 'pageBreak':
						pieces.push('<hr style="border-top:2px dashed #cbd5e1;margin:24px 0">');
						break;
					case 'toc':
						pieces.push(`<h2 style="text-align:center;color:#6b7280;font-size:${Math.round(bodySize*1.3*10)/10}pt;margin:24px 0">${escapeHtml(el.label || 'Table of Contents')}</h2>`);
						break;
				}
			}
			pieces.push('</div>');
			return pieces.join('\n');
		} catch {
			return '';
		}
	}
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

	<div class="flex-1 overflow-y-auto px-4 py-4 space-y-3">
		{#if app.messages.length === 0 && !app.isLoading}
			<div class="flex flex-col items-center justify-center h-full text-center px-6">
				<div class="w-10 h-10 rounded-lg bg-[var(--bg-component)] flex items-center justify-center mb-3">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 8v4l3 3" stroke="var(--fg-interactive)" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="12" r="9" stroke="var(--fg-interactive)" stroke-width="1.5"/></svg>
				</div>
				<p class="text-sm text-[var(--fg-subtle)]">Start a conversation to generate your document</p>
				<p class="text-xs text-[var(--fg-muted)] mt-1.5">Try: &ldquo;Write a business proposal for a tech startup&rdquo;</p>
				<div class="flex gap-3 mt-3">
					<kbd class="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-component)] text-[var(--fg-muted)]">/clear</kbd>
					<kbd class="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-component)] text-[var(--fg-muted)]">/stop</kbd>
				</div>
			</div>
		{/if}

		{#each app.messages as msg (msg.id)}
			<div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
				<div class="max-w-[82%] {msg.role === 'user' ? 'bg-[var(--fg-interactive)] text-[var(--fg-on-color)] rounded-2xl rounded-br-md' : 'bg-[var(--bg-component)] text-[var(--fg-base)] border border-[var(--border-base)] rounded-2xl rounded-bl-md'} px-3.5 py-2.5">
					{#if msg.role === 'assistant'}
						<div class="text-sm leading-relaxed">{@html renderPreview(msg.content)}</div>
					{:else}
						<div class="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
					{/if}
				</div>
			</div>
		{/each}

		{#if app.isLoading}
			<div class="flex justify-start">
				<div class="bg-[var(--bg-component)] border border-[var(--border-base)] rounded-2xl rounded-bl-md px-3.5 py-3 max-w-[82%]">
					<div class="flex items-center gap-2 mb-2">
						<span class="w-1.5 h-1.5 rounded-full bg-[var(--fg-interactive)] animate-pulse"></span>
						<span class="text-xs text-[var(--fg-subtle)]">Generating...</span>
					</div>
					{#if app.activeSection}
						<div class="text-xs text-[var(--fg-interactive-hover)] mb-1.5">
							Writing: {app.activeSection}
						</div>
					{/if}
					{#if app.progressSections.length > 0}
						<div class="space-y-0.5">
							{#each app.progressSections as section}
								<div class="flex items-center gap-1.5 text-xs {section === app.activeSection ? 'text-[var(--fg-interactive)]' : 'text-[var(--tag-green-text)]'}">
									<span class="text-[10px]">{section === app.activeSection ? '○' : '✓'}</span>
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
	</div>

	<div class="p-3 border-t border-[var(--border-base)] bg-[var(--bg-subtle)]">
		<div class="flex gap-2">
			<div class="flex-1 relative">
				<textarea
					bind:value={app.chatInput}
					onkeydown={handleKeydown}
					placeholder={app.isLoading ? 'AI is generating...' : app.currentDoc ? 'Type a message...' : 'Open a document to start'}
					class="w-full bg-[var(--bg-field)] border border-[var(--border-base)] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--border-interactive)] focus:ring-1 focus:ring-[var(--border-interactive)] transition-all placeholder-[var(--fg-disabled)] text-[var(--fg-base)]"
					rows="2"
					disabled={!app.activeConnector || !app.currentDoc}
				></textarea>
			</div>
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
