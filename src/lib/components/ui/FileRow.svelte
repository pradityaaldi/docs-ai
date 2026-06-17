<script lang="ts">
	import { app } from '$lib/stores/app.svelte';
	import { renameDocument } from '$lib/actions';
	import { WordDocIcon, TrashIcon } from './icons';
	import TreeRow from './TreeRow.svelte';
	import TreeAction from './TreeAction.svelte';

	// Document leaf row in the file tree. Active when it is the open doc; reused for
	// root-level and nested folder documents. Enters inline rename when the store
	// flags this id (e.g. right after creation).
	interface Props {
		id: string;
		title: string;
		depth?: number;
		onSelect: (id: string) => void;
		onDelete: (id: string) => void;
	}

	let { id, title, depth = 0, onSelect, onDelete }: Props = $props();
	let active = $derived(app.currentDoc?.id === id);
	let displayName = $derived(title.endsWith('.docx') ? title : `${title}.docx`);

	let editing = $derived(app.renamingDocId === id);
	let draft = $state('');
	let committing = false;
	let lastEditing = false;

	// Seed the draft only on the false→true edit transition so live title updates
	// (e.g. refreshTree) never clobber what the user is typing.
	$effect(() => {
		if (editing && !lastEditing) {
			draft = title;
			committing = false;
		}
		lastEditing = editing;
	});

	function focusSelect(node: HTMLInputElement) {
		node.focus();
		node.select();
	}

	async function commit() {
		if (committing) return;
		committing = true;
		const name = draft.trim();
		app.renamingDocId = null;
		if (name && name !== title) await renameDocument(id, name);
	}

	function cancel() {
		committing = true; // block the pending blur from committing
		app.renamingDocId = null;
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			commit();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			cancel();
		}
	}
</script>

<TreeRow label={displayName} {active} {depth} onActivate={editing ? undefined : () => onSelect(id)}>
	{#snippet leading()}
		<WordDocIcon size={18} class="shrink-0" />
	{/snippet}
	{#snippet labelContent()}
		{#if editing}
			<input
				bind:value={draft}
				use:focusSelect
				onkeydown={onKeydown}
				onblur={commit}
				onclick={(e) => e.stopPropagation()}
				class="min-w-0 flex-1 rounded border border-[var(--border-interactive)] bg-[var(--bg-field)] px-1 py-0.5 text-[15px] text-[var(--fg-base)] outline-none"
			/>
		{:else}
			<span class="min-w-0 flex-1 truncate">{displayName}</span>
		{/if}
	{/snippet}
	{#snippet actions()}
		{#if !editing}
			<TreeAction title="Delete document" danger onclick={(e) => { e.stopPropagation(); onDelete(id); }}>
				<TrashIcon size={16} />
			</TreeAction>
		{/if}
	{/snippet}
</TreeRow>
