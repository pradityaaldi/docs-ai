<script lang="ts">
	import type { Snippet } from 'svelte';

	type Variant = 'error' | 'info' | 'success';

	interface Props {
		variant?: Variant;
		class?: string;
		children?: Snippet;
	}

	let { variant = 'error', class: extra = '', children }: Props = $props();

	const variants: Record<Variant, string> = {
		error: 'text-[var(--fg-error)] bg-[var(--tag-red-bg)] border-[var(--tag-red-border)]',
		info: 'text-[var(--fg-subtle)] bg-[var(--bg-component)] border-[var(--border-base)]',
		success: 'text-[var(--tag-green-text)] bg-[var(--tag-green-bg)] border-[var(--tag-green-border)]'
	};
</script>

<div class="text-sm rounded-md border px-3 py-2 {variants[variant]} {extra}">
	{#if children}{@render children()}{/if}
</div>
