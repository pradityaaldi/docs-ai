<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends HTMLInputAttributes {
		value?: string | number;
		class?: string;
	}

	let { value = $bindable(''), class: extra = '', ...rest }: Props = $props();

	const base =
		'w-full bg-[var(--bg-field)] border border-[var(--border-base)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--border-interactive)]';
</script>

<input bind:value class="{base} {extra}" {...rest} />
