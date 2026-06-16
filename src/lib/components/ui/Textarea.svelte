<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';

	interface Props extends HTMLTextareaAttributes {
		value?: string;
		class?: string;
	}

	let { value = $bindable(''), rows = 3, class: extra = '', ...rest }: Props = $props();

	const base =
		'w-full bg-[var(--bg-field)] border border-[var(--border-base)] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--border-interactive)]';
</script>

<textarea bind:value {rows} class="{base} {extra}" {...rest}></textarea>
