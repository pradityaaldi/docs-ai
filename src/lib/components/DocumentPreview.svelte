<script lang="ts">
	import { app } from '$lib/stores/app.svelte';
	import { saveDocument, exportDocx, exportPdf } from '$lib/actions';
	import CodeEditor from '$lib/components/ui/CodeEditor.svelte';
	import prettier from 'prettier/standalone';
	import * as parserBabel from 'prettier/plugins/babel';
	import * as parserEstree from 'prettier/plugins/estree';

	let formatting = $state(false);
	let formatError = $state<string | null>(null);
	let editorFocused = $state(false);
	let lastFormattedSig = $state('');
	let autoFormatTimer: ReturnType<typeof setTimeout> | null = null;

	async function runPrettier(src: string): Promise<string> {
		return (await prettier.format(src, {
			parser: 'json',
			plugins: [parserBabel, parserEstree],
			tabWidth: 2,
			printWidth: 100
		})).trimEnd();
	}

	async function formatCode(opts: { silent?: boolean; persist?: boolean } = {}) {
		const doc = app.currentDoc;
		if (!doc) return;
		const src = doc.content || '';
		if (!src.trim()) return;
		formatting = true;
		if (!opts.silent) formatError = null;
		try {
			const formatted = await runPrettier(src);
			if (formatted !== src) {
				doc.content = formatted;
				if (opts.persist !== false) await saveDocument();
			}
			lastFormattedSig = `${doc.id}:${formatted.length}`;
		} catch (e: any) {
			if (!opts.silent) formatError = e?.message ?? String(e);
		} finally {
			formatting = false;
		}
	}

	function scheduleAutoFormat(delay = 120) {
		if (autoFormatTimer) clearTimeout(autoFormatTimer);
		autoFormatTimer = setTimeout(() => {
			autoFormatTimer = null;
			const doc = app.currentDoc;
			if (!doc) return;
			if (editorFocused) return;
			if (app.isGenerating) return;
			const sig = `${doc.id}:${(doc.content || '').length}`;
			if (sig === lastFormattedSig) return;
			formatCode({ silent: true, persist: false });
		}, delay);
	}

	$effect(() => {
		const _id = app.currentDoc?.id;
		const _len = app.currentDoc?.content?.length ?? 0;
		const _gen = app.isGenerating;
		const _tab = app.previewTab;
		void _id; void _len; void _gen; void _tab;
		scheduleAutoFormat();
	});

	const PAGE_W = 816;
	const PAGE_H = 1056;
	const PAGE_PAD = 64;
	const CONTENT_W = PAGE_W - PAGE_PAD * 2;
	const CONTENT_H = PAGE_H - PAGE_PAD * 2;

	let fitZoom = $derived(app.previewContainer ? (app.previewContainer.clientWidth - 64) / PAGE_W : 1);
	let effectiveZoom = $derived(app.zoom === -1 ? fitZoom : app.zoom);

	function escapeHtml(s: string): string {
		return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	}

	function salvageDoc(content: string): { meta: any; content: any[] } | null {
		let s = content.replace(/<think>[\s\S]*?<\/think>/g, '');
		s = s.replace(/<think>[\s\S]*$/, '');
		s = s.replace(/```(?:json)?\s*/gi, '');
		s = s.replace(/```\s*$/g, '');
		const braceIdx = s.indexOf('{');
		if (braceIdx < 0) return null;
		s = s.slice(braceIdx).trim();

		try {
			const doc = JSON.parse(s);
			if (doc && Array.isArray(doc.content)) return doc;
		} catch {}

		let meta: any = {};
		const metaIdx = s.search(/"meta"\s*:\s*\{/);
		if (metaIdx >= 0) {
			const open = s.indexOf('{', metaIdx);
			let depth = 0, inStr = false, esc = false, j = open;
			for (; j < s.length; j++) {
				const c = s[j];
				if (esc) { esc = false; continue; }
				if (c === '\\') { esc = true; continue; }
				if (c === '"') { inStr = !inStr; continue; }
				if (inStr) continue;
				if (c === '{') depth++;
				else if (c === '}') { depth--; if (depth === 0) { j++; break; } }
			}
			if (depth === 0) {
				try { meta = JSON.parse(s.slice(open, j)); } catch {}
			}
		}

		const arrMatch = s.match(/"content"\s*:\s*\[/);
		if (!arrMatch || arrMatch.index === undefined) return null;
		let i = arrMatch.index + arrMatch[0].length;
		const elements: any[] = [];
		while (i < s.length) {
			while (i < s.length && /[\s,]/.test(s[i])) i++;
			if (i >= s.length || s[i] === ']') break;
			if (s[i] !== '{') break;
			let depth = 0, inStr = false, esc = false, j = i;
			for (; j < s.length; j++) {
				const c = s[j];
				if (esc) { esc = false; continue; }
				if (c === '\\') { esc = true; continue; }
				if (c === '"') { inStr = !inStr; continue; }
				if (inStr) continue;
				if (c === '{') depth++;
				else if (c === '}') { depth--; if (depth === 0) { j++; break; } }
			}
			if (depth !== 0) break;
			try { elements.push(JSON.parse(s.slice(i, j))); } catch { break; }
			i = j;
		}
		if (elements.length === 0) return null;
		return { meta, content: elements };
	}

	function renderBlock(el: any, bodySize: number): string {
		const headingSizes: Record<number, number> = { 1: 1.6, 2: 1.3, 3: 1.15, 4: 1, 5: 0.9 };
		const headingColors: Record<number, string> = { 1: '#1e293b', 2: '#1e293b', 3: '#334155', 4: '#475569', 5: '#64748b' };
		switch (el.type) {
			case 'heading': {
				const lvl = Math.min(el.level || 1, 5);
				const sz = Math.round(bodySize * headingSizes[lvl] * 10) / 10;
				const clr = headingColors[lvl] || '#1e293b';
				const a = el.alignment === 'center' ? 'text-align:center;' : el.alignment === 'right' ? 'text-align:right;' : '';
				const t = (el.text || '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/`(.+?)`/g, '<code>$1</code>').replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:#3b82f6">$1</a>');
				return `<h${lvl} style="font-size:${sz}pt;font-weight:700;color:${clr};margin:${lvl===1?'24px':'16px'} 0 8px 0;${a}">${t}</h${lvl}>`;
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
				return `<p style="margin:6px 0;${a}">${html}</p>`;
			}
			case 'bullet':
				return '<ul style="margin:8px 0;padding-left:24px">' + (el.items || []).map((i: string) => `<li style="margin:2px 0">${escapeHtml(i)}</li>`).join('') + '</ul>';
			case 'numbered':
				return '<ol style="margin:8px 0;padding-left:24px">' + (el.items || []).map((i: string) => `<li style="margin:2px 0">${escapeHtml(i)}</li>`).join('') + '</ol>';
			case 'table': {
				let t = `<table style="border-collapse:collapse;width:100%;margin:12px 0;font-size:${Math.round((bodySize-1)*10)/10}pt">`;
				t += '<thead><tr>' + (el.headers || []).map((h: string) => `<th style="border:1px solid #d1d5db;padding:8px;background:#f3f4f6;font-weight:700;text-align:left;color:#1e293b">${escapeHtml(h)}</th>`).join('') + '</tr></thead>';
				t += '<tbody>' + (el.rows || []).map((row: string[]) => '<tr>' + row.map((c, i) => `<td style="border:1px solid #d1d5db;padding:6px;text-align:${(el.alignments || [])[i] || 'left'}">${escapeHtml(c || '')}</td>`).join('') + '</tr>').join('') + '</tbody>';
				t += '</table>';
				return t;
			}
			case 'hr':
				return '<hr style="border:none;border-top:1px solid #d1d5db;margin:16px 0">';
			case 'code':
				return `<pre style="background:#f3f4f6;padding:12px;border-radius:4px;overflow-x:auto;font-family:'Courier New',monospace;font-size:${bodySize-0.5}pt;color:#374151;margin:8px 0">${escapeHtml(el.text || '')}</pre>`;
			case 'quote':
				return `<blockquote style="border-left:4px solid #3b82f6;margin:12px 0;padding:8px 16px;background:#f8fafc;color:#475569;font-style:italic">${escapeHtml(el.text || '')}</blockquote>`;
			case 'pageBreak':
				return '__PAGEBREAK__';
			case 'toc':
				return `<h2 style="text-align:center;color:#6b7280;font-size:${Math.round(bodySize*1.3*10)/10}pt;margin:24px 0">${escapeHtml(el.label || 'Table of Contents')}</h2>`;
			default:
				return '';
		}
	}

	type DocCtx = { font: string; bodySize: number; blocks: string[] };

	let docCtx = $derived.by<DocCtx | null>(() => {
		const raw = app.currentDoc?.content || '';
		if (!raw) return null;
		const doc = salvageDoc(raw);
		if (!doc) return null;
		const meta = doc.meta || {};
		const font = meta.font || 'Arial';
		const fs = meta.fontSize || 22;
		const bodySize = Math.round(fs / 2 * 100) / 100;
		const blocks = doc.content.map((el: any) => renderBlock(el, bodySize)).filter((s: string) => s.length > 0);
		return { font, bodySize, blocks };
	});

	let measurer = $state<HTMLDivElement>();
	let pages = $state<string[][]>([[]]);

	$effect(() => {
		const ctx = docCtx;
		if (!ctx || !measurer) {
			pages = [[]];
			return;
		}
		const id = requestAnimationFrame(() => {
			if (!measurer) return;
			const children = Array.from(measurer.children) as HTMLElement[];
			const result: string[][] = [[]];
			let pageIdx = 0;
			let shift = 0;
			let pageBottom = CONTENT_H;
			const SAFETY = 2;
			for (let i = 0; i < children.length; i++) {
				const block = ctx.blocks[i];
				const el = children[i];
				if (block === '__PAGEBREAK__') {
					if (result[pageIdx].length > 0) {
						pageIdx++;
						result.push([]);
						const nextEl = children[i + 1];
						const nextTop = nextEl ? nextEl.offsetTop : el.offsetTop + el.offsetHeight;
						shift = pageIdx * CONTENT_H - nextTop;
						pageBottom = (pageIdx + 1) * CONTENT_H;
					}
					continue;
				}
				const top = el.offsetTop + shift;
				const bot = top + el.offsetHeight;
				if (bot > pageBottom - SAFETY && result[pageIdx].length > 0) {
					shift += pageBottom - top;
					pageIdx++;
					result.push([]);
					pageBottom = (pageIdx + 1) * CONTENT_H;
				}
				result[pageIdx].push(block);
			}
			pages = result;
		});
		return () => cancelAnimationFrame(id);
	});
</script>

<div class="w-1/2 flex flex-col">
	<div class="h-[45px] px-4 border-b border-[var(--border-base)] flex items-center justify-between gap-3 shrink-0">
		<div class="flex-1 min-w-0">
			{#if app.currentDoc}
				<input
					type="text"
					bind:value={app.currentDoc.title}
					onblur={saveDocument}
					class="w-full bg-transparent text-sm font-medium text-[var(--fg-base)] placeholder-[var(--fg-disabled)] outline-none transition-colors px-0.5 py-0.5"
				/>
			{:else}
				<span class="text-sm text-[var(--fg-muted)]">No document selected</span>
			{/if}
		</div>

		<div class="flex items-center gap-1.5 shrink-0">
			<div class="flex bg-[var(--bg-component)] rounded-md p-0.5">
				<button
					onclick={() => app.previewTab = 'preview'}
					class="px-2 py-1 text-xs rounded font-medium transition-colors cursor-pointer {app.previewTab === 'preview' ? 'bg-[var(--fg-interactive)] text-[var(--fg-on-color)]' : 'text-[var(--fg-subtle)] hover:text-[var(--fg-base)]'}"
				>Preview</button>
				<button
					onclick={() => app.previewTab = 'code'}
					class="px-2 py-1 text-xs rounded font-medium transition-colors cursor-pointer {app.previewTab === 'code' ? 'bg-[var(--fg-interactive)] text-[var(--fg-on-color)]' : 'text-[var(--fg-subtle)] hover:text-[var(--fg-base)]'}"
				>Code</button>
			</div>

			{#if app.previewTab === 'preview'}
				<div class="flex items-center gap-0.5 bg-[var(--bg-component)] rounded-md p-0.5">
					<button onclick={() => app.zoom = Math.max(0.25, (app.zoom === -1 ? fitZoom : app.zoom) - 0.1)} class="px-1 py-0.5 text-xs text-[var(--fg-muted)] hover:text-[var(--fg-base)] rounded transition-colors cursor-pointer" title="Zoom out">&minus;</button>
					<span class="text-[11px] text-[var(--fg-subtle)] min-w-[36px] text-center tabular-nums">{Math.round(effectiveZoom * 100)}%</span>
					<button onclick={() => app.zoom = Math.min(3, (app.zoom === -1 ? fitZoom : app.zoom) + 0.1)} class="px-1 py-0.5 text-xs text-[var(--fg-muted)] hover:text-[var(--fg-base)] rounded transition-colors cursor-pointer" title="Zoom in">+</button>
					<button onclick={() => app.zoom = -1} class="px-1 py-0.5 text-xs rounded transition-colors cursor-pointer {app.zoom === -1 ? 'text-[var(--fg-interactive)]' : 'text-[var(--fg-muted)] hover:text-[var(--fg-base)]'}" title="Fit to width">Fit</button>
				</div>
			{:else}
				<button
					onclick={() => formatCode()}
					disabled={!app.currentDoc || formatting}
					title="Format JSON with Prettier"
					class="px-2 py-1 text-xs bg-[var(--button-neutral)] hover:bg-[var(--button-neutral-hover)] disabled:opacity-50 disabled:cursor-not-allowed border border-[var(--border-base)] rounded-md transition-colors cursor-pointer text-[var(--fg-base)] flex items-center gap-1"
				>
					<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h10M4 18h16"/></svg>
					{formatting ? 'Formatting…' : 'Format'}
				</button>
			{/if}

			<div class="w-px h-5 bg-[var(--border-base)] mx-1"></div>

			<button onclick={exportDocx} disabled={!app.currentDoc} class="px-2 py-1 text-xs bg-[var(--button-neutral)] hover:bg-[var(--button-neutral-hover)] disabled:opacity-50 disabled:cursor-not-allowed border border-[var(--border-base)] rounded-md transition-colors cursor-pointer text-[var(--fg-base)]">
				DOCX
			</button>
			<button onclick={exportPdf} disabled={!app.currentDoc} class="px-2 py-1 text-xs bg-[var(--button-neutral)] hover:bg-[var(--button-neutral-hover)] disabled:opacity-50 disabled:cursor-not-allowed border border-[var(--border-base)] rounded-md transition-colors cursor-pointer text-[var(--fg-base)]">
				PDF
			</button>
		</div>
	</div>

	<div class="flex-1 overflow-hidden">
		{#if app.previewTab === 'preview'}
			<div class="h-full overflow-auto bg-[#e4e4e7]" bind:this={app.previewContainer}>
				{#if docCtx}
					<div
						bind:this={measurer}
						aria-hidden="true"
						style="position:absolute;top:-99999px;left:0;width:{CONTENT_W}px;font-family:{docCtx.font},sans-serif;font-size:{docCtx.bodySize}pt;line-height:1.5;color:#1e293b;visibility:hidden;pointer-events:none"
					>
						{#each docCtx.blocks as html}
							<div>{#if html !== '__PAGEBREAK__'}{@html html}{/if}</div>
						{/each}
					</div>
				{/if}

				<div class="flex flex-col items-center gap-6 py-10">
					{#if docCtx && pages.length > 0 && pages.some((p) => p.length > 0)}
						{#each pages as pageBlocks, idx}
							<div
								style="width: {Math.round(PAGE_W * effectiveZoom)}px; height: {Math.round(PAGE_H * effectiveZoom)}px; transition: width 0.1s, height 0.1s"
							>
								<div
									class="bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] text-gray-900 relative"
									style="transform: scale({effectiveZoom}); transform-origin: top left; width: {PAGE_W}px; height: {PAGE_H}px"
									onwheel={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); app.zoom = Math.max(0.25, Math.min(3, (app.zoom === -1 ? fitZoom : app.zoom) + (e.deltaY > 0 ? -0.05 : 0.05))); } }}
								>
									<div
										class="overflow-hidden"
										style="padding:{PAGE_PAD}px;height:{PAGE_H}px;box-sizing:border-box;font-family:{docCtx.font},sans-serif;font-size:{docCtx.bodySize}pt;line-height:1.5;color:#1e293b"
									>
										{#each pageBlocks as html}
											{@html html}
										{/each}
									</div>
									<div class="absolute bottom-2 right-3 text-[10px] text-gray-400 tabular-nums select-none">{idx + 1} / {pages.length}</div>
								</div>
							</div>
						{/each}
					{:else}
						<div
							style="width: {Math.round(PAGE_W * effectiveZoom)}px; height: {Math.round(PAGE_H * effectiveZoom)}px"
						>
							<div
								class="bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
								style="transform: scale({effectiveZoom}); transform-origin: top left; width: {PAGE_W}px; height: {PAGE_H}px"
							>
								<div class="p-16 flex flex-col items-center justify-center h-full text-center">
									<svg width="32" height="32" viewBox="0 0 40 40" fill="none" class="mb-3 opacity-15"><path d="M8 6h16l8 8v20a2 2 0 01-2 2H10a2 2 0 01-2-2V8a2 2 0 012-2z" stroke="#6b7280" stroke-width="2"/></svg>
								<p class="text-gray-400 text-sm">Document preview will appear here</p>
								<p class="text-gray-400 text-xs mt-1">Chat with AI to generate content</p>
							</div>
							</div>
						</div>
					{/if}
				</div>
			</div>
		{:else}
			<div class="h-full flex flex-col bg-[var(--bg-base)]">
				<div class="flex-1 overflow-hidden">
					{#if app.currentDoc}
						<CodeEditor
							bind:value={app.currentDoc.content}
							onFocus={() => { editorFocused = true; }}
							onBlur={async () => {
								editorFocused = false;
								await formatCode({ silent: true, persist: true });
								await saveDocument();
							}}
							placeholder={'{"meta":{"font":"Arial"},"content":[...]}'}
						/>
					{:else}
						<div class="flex items-center justify-center h-full">
							<p class="text-sm text-[var(--fg-muted)]">Select a document to view code</p>
						</div>
					{/if}
				</div>
				<div class="px-4 py-2 bg-[var(--bg-subtle)] border-t border-[var(--border-base)] flex justify-between items-center gap-3">
					<span class="text-xs text-[var(--fg-muted)] truncate">
						{#if formatError}
							<span class="text-red-400">Format error: {formatError}</span>
						{:else}
							Docx JSON &middot; auto-formatted with Prettier &middot; saves on blur{formatting ? ' · formatting…' : ''}
						{/if}
					</span>
					<span class="text-xs text-[var(--fg-muted)] shrink-0 tabular-nums">{app.currentDoc?.content?.length ?? 0} chars</span>
				</div>
			</div>
		{/if}
	</div>
</div>
