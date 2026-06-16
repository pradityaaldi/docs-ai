<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		forId?: string;
		required?: boolean;
		class?: string;
		children?: Snippet;
	}

	let { label, forId, required = false, class: extra = '', children }: Props = $props();
</script>

<div class={extra}>
	<label for={forId} class="block text-sm font-medium mb-1">
		{label}{#if required}<span class="text-[var(--fg-error)]"> *</span>{/if}
	</label>
	{#if children}{@render children()}{/if}
</div>
