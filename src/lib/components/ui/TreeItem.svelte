<script lang="ts">
	import { app, type TreeNode, type DocEntry } from '$lib/stores/app.svelte';
	import { selectDocument, loadFolderContents, deleteDocument, deleteFolder, createDocument, createFolder } from '$lib/actions';
	import TreeItem from '$lib/components/ui/TreeItem.svelte';

	interface Props {
		node: TreeNode;
		onNavigateInto: (folderId: string | null) => void;
	}

	let { node, onNavigateInto }: Props = $props();
	let loaded = $state(false);
	let subfolders: any[] = $state([]);
	let subDocuments: DocEntry[] = $state([]);

	async function toggle() {
		if (app.expandedFolderIds.has(node.id)) {
			app.expandedFolderIds.delete(node.id);
		} else {
			app.expandedFolderIds.add(node.id);
			if (!loaded) {
				const data = await loadFolderContents(node.id);
				subfolders = data.subfolders || [];
				subDocuments = data.documents || [];
				loaded = true;
			}
		}
		app.expandedFolderIds = new Set(app.expandedFolderIds);
	}

	async function onDeleteFolder(e: MouseEvent) {
		e.stopPropagation();
		await deleteFolder(node.id);
	}

	async function onCreateDocument(e: MouseEvent) {
		e.stopPropagation();
		onNavigateInto(node.id);
		await createDocument(node.id);
	}

	async function onCreateFolder(e: MouseEvent) {
		e.stopPropagation();
		onNavigateInto(node.id);
		await createFolder(node.id);
		loaded = false;
		if (app.expandedFolderIds.has(node.id)) {
			const data = await loadFolderContents(node.id);
			subfolders = data.subfolders || [];
			subDocuments = data.documents || [];
			loaded = true;
		}
	}

	async function onDeleteDoc(e: MouseEvent, docId: string) {
		e.stopPropagation();
		const deleted = await deleteDocument(docId);
		if (deleted) subDocuments = subDocuments.filter(d => d.id !== docId);
	}

	let isExpanded = $derived(app.expandedFolderIds.has(node.id));
	let displayDocCount = $derived(loaded ? subDocuments.length + node.documents.length : node.documents.length);
</script>

<div class="ml-0">
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		class="group flex cursor-pointer items-center gap-x-1.5 rounded-lg py-1.5 pl-2 pr-1 text-sm text-[var(--fg-subtle)] transition-colors hover:bg-[var(--bg-base-hover)]"
		onclick={toggle}
		role="button"
		tabindex="0"
		onkeydown={(e) => e.key === 'Enter' && toggle()}
	>
		<svg width="12" height="12" viewBox="0 0 16 16" fill="none" class="shrink-0 transition-transform {isExpanded ? 'rotate-90' : ''}">
			<path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
		</svg>
		<svg width="14" height="14" viewBox="0 0 16 16" fill="none" class="shrink-0">
			<path d="M2 4h4.5l1.5 1.5H14v7H2V4z" fill="currentColor" opacity="0.3"/>
			<path d="M2 4h4.5l1.5 1.5H14v7H2V4z" stroke="currentColor" stroke-width="1.2"/>
		</svg>
		<span class="flex-1 min-w-0 truncate">{node.name}</span>
		<span class="text-xs text-[var(--fg-muted)]">{displayDocCount}</span>

		<div class="hidden group-hover:flex items-center gap-x-0.5 ml-0.5">
			<button onclick={onCreateDocument} title="New document" class="rounded p-0.5 text-[var(--fg-muted)] hover:text-[var(--fg-base)]">
				<svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
			</button>
			<button onclick={onCreateFolder} title="New folder" class="rounded p-0.5 text-[var(--fg-muted)] hover:text-[var(--fg-base)]">
				<svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M2 4h4.5l1.5 1.5H14v7H2V4z" stroke="currentColor" stroke-width="1.2"/><path d="M7 9h4M9 7v4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
			</button>
			<button onclick={onDeleteFolder} title="Delete folder" class="rounded p-0.5 text-[var(--fg-muted)] hover:text-[var(--fg-error)]">
				<svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M5 4V3h4v1M4 4v7a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
			</button>
		</div>
	</div>

	{#if isExpanded}
		<div class="ml-3 border-l border-[var(--border-base)] pl-2">
			{#each node.documents as doc (doc.id)}
				<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
				<div
					class="group flex cursor-pointer items-center gap-x-1.5 rounded-lg py-1.5 pl-2 pr-1 text-sm transition-colors {app.currentDoc?.id === doc.id ? 'bg-[var(--bg-subtle)] text-[var(--fg-base)] ring-1 ring-[var(--border-base)]' : 'text-[var(--fg-subtle)] hover:bg-[var(--bg-base-hover)]'}"
					onclick={() => selectDocument({ id: doc.id })}
					role="button"
					tabindex="0"
					onkeydown={(e) => e.key === 'Enter' && selectDocument({ id: doc.id })}
				>
					<svg width="12" height="12" viewBox="0 0 16 16" fill="none" class="shrink-0"><path d="M4 2h8l2 2v10H2V4l2-2z" stroke="currentColor" stroke-width="1.2"/><path d="M6 7h6M6 10h4" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>
					<span class="flex-1 min-w-0 truncate">{doc.title}</span>
					<button
						onclick={(e) => onDeleteDoc(e, doc.id)}
						aria-label="Delete document"
						class="hidden rounded p-0.5 text-[var(--fg-muted)] hover:text-[var(--fg-error)] group-hover:block"
					>
						<svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M5 4V3h4v1M4 4v7a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
					</button>
				</div>
			{/each}

			{#if loaded}
				{#each subfolders as sf (sf.id)}
					<TreeItem node={{
						id: sf.id,
						name: sf.name,
						type: 'folder',
						parent_id: node.id,
						children: [],
						documents: []
					}} onNavigateInto={onNavigateInto} />
				{/each}

				{#each subDocuments as sdoc (sdoc.id)}
					<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
					<div
						class="group flex cursor-pointer items-center gap-x-1.5 rounded-lg py-1.5 pl-2 pr-1 text-sm transition-colors {app.currentDoc?.id === sdoc.id ? 'bg-[var(--bg-subtle)] text-[var(--fg-base)] ring-1 ring-[var(--border-base)]' : 'text-[var(--fg-subtle)] hover:bg-[var(--bg-base-hover)]'}"
						onclick={() => selectDocument({ id: sdoc.id })}
						role="button"
						tabindex="0"
						onkeydown={(e) => e.key === 'Enter' && selectDocument({ id: sdoc.id })}
					>
						<svg width="12" height="12" viewBox="0 0 16 16" fill="none" class="shrink-0"><path d="M4 2h8l2 2v10H2V4l2-2z" stroke="currentColor" stroke-width="1.2"/><path d="M6 7h6M6 10h4" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>
						<span class="flex-1 min-w-0 truncate">{sdoc.title}</span>
						<button
							onclick={(e) => onDeleteDoc(e, sdoc.id)}
							aria-label="Delete document"
							class="hidden rounded p-0.5 text-[var(--fg-muted)] hover:text-[var(--fg-error)] group-hover:block"
						>
							<svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M5 4V3h4v1M4 4v7a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
						</button>
					</div>
				{/each}
			{/if}
		</div>
	{/if}
</div>
