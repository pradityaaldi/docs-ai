<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		subtitle?: string;
		/** right-aligned actions (e.g. a back link) */
		actions?: Snippet;
		class?: string;
	}

	let { title, subtitle, actions, class: extra = '' }: Props = $props();
</script>

<header class="border-b border-[var(--border-base)] px-6 py-4 flex items-center justify-between {extra}">
	<div>
		<h1 class="text-lg font-semibold">{title}</h1>
		{#if subtitle}<p class="text-sm text-[var(--fg-muted)]">{subtitle}</p>{/if}
	</div>
	{#if actions}{@render actions()}{/if}
</header>
