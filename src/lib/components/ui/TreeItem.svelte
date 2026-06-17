<script lang="ts">
	import { app, type TreeNode, type DocEntry } from '$lib/stores/app.svelte';
	import {
		selectDocument,
		loadFolderContents,
		deleteDocument,
		deleteFolder,
		createDocument,
		createFolder
	} from '$lib/actions';
	import TreeItem from './TreeItem.svelte';
	import TreeRow from './TreeRow.svelte';
	import TreeAction from './TreeAction.svelte';
	import FileRow from './FileRow.svelte';
	import { FolderIcon, FolderOpenIcon, FilePlusIcon, FolderPlusIcon, TrashIcon } from './icons';

	interface Props {
		node: TreeNode;
		depth?: number;
		onNavigateInto: (folderId: string | null) => void;
	}

	let { node, depth = 0, onNavigateInto }: Props = $props();
	let loaded = $state(false);
	let subfolders: TreeNode[] = $state([]);
	let subDocuments: DocEntry[] = $state([]);

	async function refresh() {
		const data = await loadFolderContents(node.id);
		subfolders = data.subfolders || [];
		subDocuments = data.documents || [];
		loaded = true;
	}

	async function toggle() {
		if (app.expandedFolderIds.has(node.id)) {
			app.expandedFolderIds.delete(node.id);
		} else {
			app.expandedFolderIds.add(node.id);
			if (!loaded) await refresh();
		}
		app.expandedFolderIds = new Set(app.expandedFolderIds);
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
		if (app.expandedFolderIds.has(node.id)) await refresh();
	}

	function onDeleteFolder(e: MouseEvent) {
		e.stopPropagation();
		deleteFolder(node.id);
	}

	async function onDeleteDoc(id: string) {
		const deleted = await deleteDocument(id);
		if (deleted) subDocuments = subDocuments.filter((d) => d.id !== id);
	}

	let isExpanded = $derived(app.expandedFolderIds.has(node.id));
</script>

<TreeRow
	label={node.name}
	expandable
	expanded={isExpanded}
	{depth}
	onActivate={toggle}
>
	{#snippet leading()}
		{#if isExpanded}
			<FolderOpenIcon size={14} class="shrink-0 text-[var(--fg-interactive)]" />
		{:else}
			<FolderIcon size={14} class="shrink-0 text-[var(--fg-muted)]" />
		{/if}
	{/snippet}
	{#snippet actions()}
		<TreeAction title="New document" onclick={onCreateDocument}><FilePlusIcon size={12} /></TreeAction>
		<TreeAction title="New folder" onclick={onCreateFolder}><FolderPlusIcon size={12} /></TreeAction>
		<TreeAction title="Delete folder" danger onclick={onDeleteFolder}><TrashIcon size={12} /></TreeAction>
	{/snippet}
</TreeRow>

{#if isExpanded}
	{#each node.documents as doc (doc.id)}
		<FileRow id={doc.id} title={doc.title} depth={depth + 1} onSelect={(id) => selectDocument({ id })} onDelete={onDeleteDoc} />
	{/each}

	{#if loaded}
		{#each subfolders as sf (sf.id)}
			<TreeItem
				node={{ id: sf.id, name: sf.name, type: 'folder', parent_id: node.id, children: [], documents: [] }}
				depth={depth + 1}
				{onNavigateInto}
			/>
		{/each}

		{#each subDocuments as sdoc (sdoc.id)}
			<FileRow id={sdoc.id} title={sdoc.title} depth={depth + 1} onSelect={(id) => selectDocument({ id })} onDelete={onDeleteDoc} />
		{/each}
	{/if}
{/if}
