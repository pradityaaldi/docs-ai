<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ChevronRightIcon } from './icons';

	// Generic VSCode-style file-tree row: dense, full-bleed hover, depth-based
	// indent guides (one vertical rule per nesting level), optional expand chevron,
	// leading icon, label and hover-revealed actions. Files reserve the chevron slot
	// so their icon aligns under a folder's icon.
	interface Props {
		label: string;
		active?: boolean;
		expandable?: boolean;
		expanded?: boolean;
		depth?: number;
		onActivate?: () => void;
		leading?: Snippet;
		labelContent?: Snippet;
		actions?: Snippet;
	}

	let {
		label,
		active = false,
		expandable = false,
		expanded = false,
		depth = 0,
		onActivate,
		leading,
		labelContent,
		actions
	}: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
	role="button"
	tabindex="0"
	onclick={onActivate}
	onkeydown={(e) => e.key === 'Enter' && onActivate?.()}
	class="group/row flex min-h-10 cursor-pointer select-none items-center gap-x-1.5 py-1 pr-2 text-[15px] transition-colors {active
		? 'bg-[var(--bg-base-pressed)] text-[var(--fg-base)]'
		: 'text-[var(--fg-subtle)] hover:bg-[var(--bg-base-hover)]'}"
>
	{#each Array(depth) as _, i (i)}
		<span class="w-4 shrink-0 self-stretch border-l border-[var(--border-base)]"></span>
	{/each}

	{#if expandable}
		<ChevronRightIcon
			size={18}
			class="ml-1 shrink-0 text-[var(--fg-muted)] transition-transform {expanded ? 'rotate-90' : ''}"
		/>
	{:else}
		<span class="ml-1 w-[18px] shrink-0"></span>
	{/if}

	{#if leading}{@render leading()}{/if}

	{#if labelContent}
		{@render labelContent()}
	{:else}
		<span class="min-w-0 flex-1 truncate">{label}</span>
	{/if}

	{#if actions}
		<div class="ml-0.5 hidden h-6 items-center gap-x-0.5 group-hover/row:flex">
			{@render actions()}
		</div>
	{/if}
</div>
