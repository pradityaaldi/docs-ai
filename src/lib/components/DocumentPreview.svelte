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

<div class="{app.mobileView === 'document' ? 'flex' : 'hidden'} min-w-0 flex-1 flex-col bg-[var(--bg-subtle)] lg:flex">
	<div class="flex shrink-0 flex-col gap-2 border-b border-[var(--border-base)] bg-[var(--bg-base)] px-3 py-2 lg:h-14 lg:flex-row lg:items-center lg:justify-between lg:gap-3 lg:py-0 lg:px-4">
		<div class="min-w-0 flex-1">
			{#if app.currentDoc}
				<input
					type="text"
					bind:value={app.currentDoc.title}
					onblur={saveDocument}
					class="w-full bg-transparent px-0.5 py-0.5 text-sm font-semibold text-[var(--fg-base)] outline-none transition-colors placeholder-[var(--fg-disabled)]"
				/>
				<p class="hidden px-0.5 text-[11px] text-[var(--fg-muted)] sm:block">Preview and structured JSON editor</p>
			{:else}
				<span class="text-sm text-[var(--fg-muted)]">No document selected</span>
			{/if}
		</div>

		<div class="flex shrink-0 items-center gap-1.5 overflow-x-auto pb-1 lg:overflow-visible lg:pb-0">
			<div class="flex shrink-0 rounded-lg border border-[var(--border-base)] bg-[var(--bg-subtle)] p-0.5">
				<button
					onclick={() => app.previewTab = 'preview'}
					class="rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors {app.previewTab === 'preview' ? 'bg-[var(--bg-component)] text-[var(--fg-base)] shadow-sm ring-1 ring-[var(--border-base)]' : 'text-[var(--fg-subtle)] hover:text-[var(--fg-base)]'}"
				>Preview</button>
				<button
					onclick={() => app.previewTab = 'code'}
					class="rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors {app.previewTab === 'code' ? 'bg-[var(--bg-component)] text-[var(--fg-base)] shadow-sm ring-1 ring-[var(--border-base)]' : 'text-[var(--fg-subtle)] hover:text-[var(--fg-base)]'}"
				>Code</button>
			</div>

			{#if app.previewTab === 'preview'}
				<div class="flex shrink-0 items-center gap-0.5 rounded-lg border border-[var(--border-base)] bg-[var(--bg-subtle)] p-0.5">
					<button onclick={() => app.zoom = Math.max(0.25, (app.zoom === -1 ? fitZoom : app.zoom) - 0.1)} class="rounded px-1.5 py-1 text-xs text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-component)] hover:text-[var(--fg-base)]" title="Zoom out">&minus;</button>
					<span class="text-[11px] text-[var(--fg-subtle)] min-w-[36px] text-center tabular-nums">{Math.round(effectiveZoom * 100)}%</span>
					<button onclick={() => app.zoom = Math.min(3, (app.zoom === -1 ? fitZoom : app.zoom) + 0.1)} class="rounded px-1.5 py-1 text-xs text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-component)] hover:text-[var(--fg-base)]" title="Zoom in">+</button>
					<button onclick={() => app.zoom = -1} class="rounded px-1.5 py-1 text-xs transition-colors {app.zoom === -1 ? 'bg-[var(--bg-component)] text-[var(--fg-base)] shadow-sm' : 'text-[var(--fg-muted)] hover:text-[var(--fg-base)]'}" title="Fit to width">Fit</button>
				</div>
			{:else}
				<button
					onclick={() => formatCode()}
					disabled={!app.currentDoc || formatting}
					title="Format JSON with Prettier"
					class="flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border-base)] bg-[var(--button-neutral)] px-2.5 py-1.5 text-xs text-[var(--fg-base)] transition-colors hover:bg-[var(--button-neutral-hover)] disabled:cursor-not-allowed disabled:opacity-50"
				>
					<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h10M4 18h16"/></svg>
					{formatting ? 'Formatting…' : 'Format'}
				</button>
			{/if}

			<div class="mx-1 h-5 w-px shrink-0 bg-[var(--border-base)]"></div>

			<button onclick={exportDocx} disabled={!app.currentDoc} class="shrink-0 rounded-lg border border-[var(--border-base)] bg-[var(--button-neutral)] px-2.5 py-1.5 text-xs text-[var(--fg-base)] transition-colors hover:bg-[var(--button-neutral-hover)] disabled:cursor-not-allowed disabled:opacity-50">
				DOCX
			</button>
			<button onclick={exportPdf} disabled={!app.currentDoc} class="shrink-0 rounded-lg border border-[var(--border-base)] bg-[var(--button-neutral)] px-2.5 py-1.5 text-xs text-[var(--fg-base)] transition-colors hover:bg-[var(--button-neutral-hover)] disabled:cursor-not-allowed disabled:opacity-50">
				PDF
			</button>
		</div>
	</div>

	<div class="flex-1 overflow-hidden">
		{#if app.previewTab === 'preview'}
			<div class="h-full overflow-auto bg-[var(--bg-subtle)]" bind:this={app.previewContainer}>
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
									class="relative bg-white text-gray-900 shadow-[0_16px_48px_rgba(15,23,42,0.12),0_0_0_1px_rgba(15,23,42,0.08)]"
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
			<div class="flex h-full flex-col bg-[var(--bg-base)]">
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
				<div class="flex items-center justify-between gap-3 border-t border-[var(--border-base)] bg-[var(--bg-subtle)] px-4 py-2">
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
