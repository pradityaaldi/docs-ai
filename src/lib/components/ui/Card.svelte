<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** corner radius: lg (rounded-lg) or xl (rounded-xl) */
		rounded?: 'lg' | 'xl';
		/** inner padding scale */
		padding?: 'none' | 'sm' | 'md' | 'lg';
		class?: string;
		children?: Snippet;
	}

	let { rounded = 'xl', padding = 'md', class: extra = '', children }: Props = $props();

	const pad: Record<string, string> = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-8' };
	const radius: Record<string, string> = { lg: 'rounded-lg', xl: 'rounded-xl' };
</script>

<div class="bg-[var(--bg-component)] border border-[var(--border-base)] {radius[rounded]} {pad[padding]} {extra}">
	{#if children}{@render children()}{/if}
</div>
