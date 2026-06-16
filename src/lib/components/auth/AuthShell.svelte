<script lang="ts">
	import type { Snippet } from 'svelte';
	import Card from '$lib/components/ui/Card.svelte';

	interface Props {
		children?: Snippet;
	}

	let { children }: Props = $props();
</script>

<div class="min-h-dvh flex items-center justify-center p-4">
	<Card padding="lg" class="w-full max-w-sm">
		{#if children}{@render children()}{/if}
	</Card>
</div>
