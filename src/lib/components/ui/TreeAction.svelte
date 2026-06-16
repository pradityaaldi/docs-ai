<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		danger?: boolean;
		onclick: (e: MouseEvent) => void;
		children: Snippet;
	}

	let { title, danger = false, onclick, children }: Props = $props();
</script>

<button
	{title}
	aria-label={title}
	{onclick}
	class="rounded p-0.5 text-[var(--fg-muted)] transition-colors {danger
		? 'hover:text-[var(--fg-error)]'
		: 'hover:text-[var(--fg-base)]'}"
>
	{@render children()}
</button>
