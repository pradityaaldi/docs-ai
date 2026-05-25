<script lang="ts">
	import { app } from '$lib/stores/app.svelte';
	import { createDocument, selectDocument, deleteDocument } from '$lib/actions';
	let logoRef = $state<HTMLDivElement>();
</script>

<aside class="flex flex-1 flex-col justify-between overflow-y-auto border-e border-[var(--border-base)]">
	<div class="flex flex-1 flex-col">
		<div class="bg-[var(--bg-subtle)] sticky top-0 z-10">
			<div class="h-[45px] px-4 flex items-center gap-x-2.5 border-b border-[var(--border-base)]">
				<div class="w-6 h-6 rounded-md bg-[var(--fg-interactive)] flex items-center justify-center">
					<svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 4h3l1-2h4l1 2h3v9H2V4z" fill="white" opacity="0.9"/></svg>
				</div>
				<span class="text-sm font-medium text-[var(--fg-base)]">Docs AI</span>
			</div>
		</div>

		<div class="flex flex-1 flex-col justify-between">
			<div class="flex flex-1 flex-col">
				<div class="px-3 pt-3">
					<button
						onclick={createDocument}
						class="w-full flex items-center gap-x-2 px-3 py-1.5 rounded-md text-sm text-[var(--fg-subtle)] transition-fg hover:bg-[var(--bg-base-hover)] cursor-pointer outline-none"
					>
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
						New Document
					</button>
				</div>

				<div class="px-3 py-2">
					<p class="px-3 py-1.5 text-xs font-medium text-[var(--fg-muted)]">Documents</p>
					<div class="flex flex-col gap-y-0.5">
						{#each app.documents as doc (doc.id)}
							<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
							<div
								class="group text-[var(--fg-subtle)] transition-fg hover:bg-[var(--bg-base-hover)] flex items-center gap-x-2 rounded-md py-1 pl-2 pr-1.5 outline-none cursor-pointer text-sm {app.currentDoc?.id === doc.id ? 'bg-[var(--bg-base)] text-[var(--fg-base)] hover:bg-[var(--bg-base)] shadow-[0_1px_2px_rgba(0,0,0,0.2)]' : ''}"
								onclick={() => selectDocument(doc)}
								role="button"
								tabindex="0"
								onkeydown={(e) => e.key === 'Enter' && selectDocument(doc)}
							>
								<div class="flex-1 min-w-0 flex flex-col">
									<span class="truncate">{doc.title}</span>
									<span class="text-xs text-[var(--fg-muted)]">{new Date(doc.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
								</div>
								<button
									onclick={(e) => { e.stopPropagation(); deleteDocument(doc.id); }}
									class="opacity-0 group-hover:opacity-100 p-1 text-[var(--fg-muted)] hover:text-[var(--fg-error)] transition-all cursor-pointer rounded"
								>
									<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M5 4V3h4v1M4 4v7a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
								</button>
							</div>
						{/each}
						{#if app.documents.length === 0}
							<div class="text-center py-6 px-2">
								<p class="text-xs text-[var(--fg-muted)]">No documents yet</p>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<div class="px-3 pb-2">
				<button
					onclick={() => app.showSettings = true}
					class="w-full flex items-center gap-x-2 px-3 py-1.5 rounded-md text-sm text-[var(--fg-subtle)] transition-fg hover:bg-[var(--bg-base-hover)] cursor-pointer outline-none"
				>
					<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 10a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" stroke-width="1.5"/><path d="M14.5 8a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" stroke="currentColor" stroke-width="1.5"/></svg>
					Settings
				</button>
			</div>
		</div>
	</div>

	<div class="bg-[var(--bg-subtle)] sticky bottom-0">
		<div class="px-3 py-3 border-t border-[var(--border-base)]">
			{#if app.activeConnector}
				<div class="flex items-center gap-x-2 px-2">
					<span class="w-1.5 h-1.5 rounded-full bg-[var(--tag-green-text)] shrink-0"></span>
					<span class="text-xs text-[var(--fg-subtle)] truncate">{app.activeConnector.name}</span>
				</div>
			{:else}
				<div class="flex items-center gap-x-2 px-2">
					<span class="w-1.5 h-1.5 rounded-full bg-[var(--fg-error)] shrink-0"></span>
					<span class="text-xs text-[var(--fg-subtle)]">No AI connector</span>
				</div>
			{/if}
		</div>
	</div>
</aside>
