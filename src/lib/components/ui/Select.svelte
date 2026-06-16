<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLSelectAttributes } from 'svelte/elements';

	interface Props extends HTMLSelectAttributes {
		value?: string;
		class?: string;
		children?: Snippet;
	}

	let { value = $bindable(''), class: extra = '', children, ...rest }: Props = $props();

	const base =
		'w-full bg-[var(--bg-field)] border border-[var(--border-base)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--border-interactive)]';
</script>

<select bind:value class="{base} {extra}" {...rest}>
	{#if children}{@render children()}{/if}
</select>
