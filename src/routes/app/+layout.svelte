<script lang="ts">
	import '../../app.css';
	import { navigating } from '$app/state';
	import WorkspaceSkeleton from '$lib/components/WorkspaceSkeleton.svelte';

	let { children } = $props();

	// While load() for /app/[id] is in flight, show the workspace skeleton instead of
	// the outgoing page — instant feedback on click, covers the real flash window.
	let bootingWorkspace = $derived(navigating.to?.route?.id === '/app/[id]');
</script>

{#if bootingWorkspace}
	<WorkspaceSkeleton />
{:else}
	{@render children()}
{/if}
