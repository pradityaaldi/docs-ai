<script lang="ts">
	import { app } from '$lib/stores/app.svelte';
	import { FileTextIcon, TrashIcon } from './icons';
	import TreeRow from './TreeRow.svelte';
	import TreeAction from './TreeAction.svelte';

	// Document leaf row in the file tree. Active when it is the open doc; reused for
	// root-level and nested folder documents.
	interface Props {
		id: string;
		title: string;
		onSelect: (id: string) => void;
		onDelete: (id: string) => void;
	}

	let { id, title, onSelect, onDelete }: Props = $props();
	let active = $derived(app.currentDoc?.id === id);
</script>

<TreeRow label={title} {active} onActivate={() => onSelect(id)}>
	{#snippet leading()}
		<FileTextIcon size={14} class="shrink-0 text-[var(--fg-muted)]" />
	{/snippet}
	{#snippet actions()}
		<TreeAction title="Delete document" danger onclick={(e) => { e.stopPropagation(); onDelete(id); }}>
			<TrashIcon size={12} />
		</TreeAction>
	{/snippet}
</TreeRow>
