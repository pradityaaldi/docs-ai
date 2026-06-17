<script lang="ts">
	import type { MentionItem } from '$lib/stores/app.svelte';
	import { FileTextIcon, FolderIcon } from '$lib/components/ui/icons';

	interface Props {
		items: MentionItem[];
		activeIndex: number;
		onpick: (item: MentionItem) => void;
	}
	let { items, activeIndex, onpick }: Props = $props();
</script>

{#if items.length}
	<div class="absolute bottom-full left-0 z-20 mb-2 max-h-56 w-72 overflow-y-auto rounded-lg border border-[var(--border-base)] bg-[var(--bg-component)] py-1 shadow-xl">
		<div class="px-3 py-1 text-[10px] uppercase tracking-wide text-[var(--fg-disabled)]">Files & folders</div>
		{#each items as item, i (item.id)}
			<button
				type="button"
				onmousedown={(e) => { e.preventDefault(); onpick(item); }}
				class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm {i === activeIndex ? 'bg-[var(--bg-base-hover)] text-[var(--fg-base)]' : 'text-[var(--fg-muted)]'}"
			>
				{#if item.type === 'folder'}
					<FolderIcon size={14} class="shrink-0 text-[var(--fg-muted)]" />
				{:else}
					<FileTextIcon size={14} class="shrink-0 text-[var(--fg-muted)]" />
				{/if}
				<span class="truncate">{item.title}</span>
				<span class="ml-auto shrink-0 text-[10px] text-[var(--fg-disabled)]">{item.type}</span>
			</button>
		{/each}
	</div>
{/if}
