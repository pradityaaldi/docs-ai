<script lang="ts">
	import { app } from '$lib/stores/app.svelte';
	import { saveDocument, exportDocx, exportPdf } from '$lib/actions';
	import CodeEditor from '$lib/components/ui/CodeEditor.svelte';
	import { normalizeDoc } from '$lib/shared/toc';
	import { renderIllustration, illustrationKey, getCachedIllustration } from '$lib/shared/illustration';
	import { salvageDoc, renderBlock, PAGEBREAK_MARKER } from './document-preview/render';
	import { paginate } from './document-preview/paginate';
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

	type DocCtx = { font: string; bodySize: number; blocks: string[] };

	let docCtx = $derived.by<DocCtx | null>(() => {
		void illustrationTick;
		const raw = app.currentDoc?.content || '';
		if (!raw) return null;
		const doc = salvageDoc(raw);
		if (!doc) return null;
		normalizeDoc(doc);
		const meta = doc.meta || {};
		const font = meta.font || 'Arial';
		const fs = meta.fontSize || 22;
		const bodySize = Math.round(fs / 2 * 100) / 100;
		const blocks = doc.content.map((el: any) => renderBlock(el, bodySize, ensureIllustration)).filter((s: string) => s.length > 0);
		return { font, bodySize, blocks };
	});

	let measurer = $state<HTMLDivElement>();
	let pages = $state<string[][]>([[]]);
	let illustrationTick = $state(0);
	const pendingIllustrations = new Set<string>();

	function ensureIllustration(html: string, width: number, height: number): string | null {
		const key = illustrationKey(html, width, height);
		const cached = getCachedIllustration(key);
		if (cached) return cached;
		if (pendingIllustrations.has(key)) return null;
		pendingIllustrations.add(key);
		renderIllustration(html, width, height)
			.then(() => {
				illustrationTick++;
			})
			.catch((e) => {
				console.error('[illustration] render failed', e);
				illustrationTick++;
			})
			.finally(() => {
				pendingIllustrations.delete(key);
			});
		return null;
	}

	$effect(() => {
		const ctx = docCtx;
		if (!ctx || !measurer) {
			pages = [[]];
			return;
		}
		const id = requestAnimationFrame(() => {
			if (!measurer) return;
			const children = Array.from(measurer.children) as HTMLElement[];
			pages = paginate(children, ctx.blocks, CONTENT_H);
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
							<div>{#if html !== PAGEBREAK_MARKER}{@html html}{/if}</div>
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
						<div class="flex items-center justify-center h-full">
							<div class="text-center">
								<svg width="48" height="48" viewBox="0 0 48 48" fill="none" class="mx-auto mb-4 opacity-20">
									<path d="M8 4h24l12 12v28a2 2 0 01-2 2H10a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="currentColor" stroke-width="2" class="text-[var(--fg-muted)]"/>
									<path d="M20 18h12M20 24h8M20 30h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" class="text-[var(--fg-muted)]"/>
								</svg>
								<p class="text-sm font-medium text-[var(--fg-muted)]">No document selected</p>
								<p class="text-xs text-[var(--fg-muted)] mt-1 max-w-[220px] leading-relaxed">Select a document from the sidebar to preview and edit its content here</p>
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
