<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ChevronRightIcon } from './icons';

	// Generic file-tree row: optional expand chevron, leading icon, label, trailing
	// count (hidden on hover) and hover-revealed actions. Files reserve the chevron
	// slot so their icon aligns under a folder's icon.
	interface Props {
		label: string;
		active?: boolean;
		expandable?: boolean;
		expanded?: boolean;
		count?: number;
		onActivate?: () => void;
		leading?: Snippet;
		actions?: Snippet;
	}

	let {
		label,
		active = false,
		expandable = false,
		expanded = false,
		count,
		onActivate,
		leading,
		actions
	}: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
	role="button"
	tabindex="0"
	onclick={onActivate}
	onkeydown={(e) => e.key === 'Enter' && onActivate?.()}
	class="group/row flex cursor-pointer items-center gap-x-1.5 rounded-lg py-1.5 pl-1.5 pr-1 text-sm transition-colors {active
		? 'bg-[var(--bg-subtle)] text-[var(--fg-base)] ring-1 ring-[var(--border-base)]'
		: 'text-[var(--fg-subtle)] hover:bg-[var(--bg-base-hover)]'}"
>
	{#if expandable}
		<ChevronRightIcon
			size={12}
			class="shrink-0 text-[var(--fg-muted)] transition-transform {expanded ? 'rotate-90' : ''}"
		/>
	{:else}
		<span class="w-3 shrink-0"></span>
	{/if}

	{#if leading}{@render leading()}{/if}

	<span class="min-w-0 flex-1 truncate">{label}</span>

	{#if count !== undefined}
		<span class="text-xs text-[var(--fg-muted)] {actions ? 'group-hover/row:hidden' : ''}">{count}</span>
	{/if}
	{#if actions}
		<div class="ml-0.5 hidden items-center gap-x-0.5 group-hover/row:flex">
			{@render actions()}
		</div>
	{/if}
</div>
