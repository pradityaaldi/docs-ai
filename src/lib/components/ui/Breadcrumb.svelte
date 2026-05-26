<script lang="ts">
	interface Props {
		path: { id: string; name: string; type: 'project' | 'folder' }[];
		onNavigate: (index: number) => void;
	}

	let { path, onNavigate }: Props = $props();
</script>

<nav class="px-3 py-1.5 flex items-center gap-x-1 text-xs text-[var(--fg-muted)] flex-wrap" aria-label="Breadcrumb">
	{#each path as segment, i}
		{#if i > 0}
			<svg width="10" height="10" viewBox="0 0 16 16" fill="none" class="shrink-0"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
		{/if}
		<button
			class="hover:text-[var(--fg-base)] transition-fg cursor-pointer rounded px-1 py-0.5 truncate max-w-[120px] {i === path.length - 1 ? 'text-[var(--fg-base)] font-medium' : ''}"
			onclick={() => onNavigate(i)}
			title={segment.name}
		>
			{segment.name}
		</button>
	{/each}
</nav>
