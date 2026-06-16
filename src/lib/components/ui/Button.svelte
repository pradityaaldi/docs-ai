<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Variant = 'primary' | 'neutral' | 'danger' | 'ghost';
	type Size = 'sm' | 'md';

	interface Props extends HTMLButtonAttributes {
		variant?: Variant;
		size?: Size;
		full?: boolean;
		loading?: boolean;
		href?: string;
		class?: string;
		children?: Snippet;
	}

	let {
		variant = 'primary',
		size = 'md',
		full = false,
		loading = false,
		href,
		type = 'button',
		disabled,
		class: extra = '',
		children,
		...rest
	}: Props = $props();

	const base =
		'inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

	const variants: Record<Variant, string> = {
		primary: 'bg-[var(--fg-interactive)] text-[var(--fg-on-color)] hover:opacity-90',
		neutral: 'border border-[var(--border-base)] text-[var(--fg-base)] hover:bg-[var(--bg-base-hover)]',
		danger: 'bg-[var(--button-danger)] text-[var(--fg-on-color)] hover:bg-[var(--button-danger-hover)]',
		ghost: 'text-[var(--fg-error)] hover:underline'
	};

	const sizes: Record<Size, string> = {
		sm: 'px-2 py-1 text-xs rounded',
		md: 'px-3 py-2 text-sm rounded-lg'
	};

	let cls = $derived(
		`${base} ${variants[variant]} ${sizes[size]} ${full ? 'w-full' : ''} ${extra}`
	);
</script>

{#if href}
	<a {href} class={cls} {...rest as Record<string, unknown>}>
		{#if children}{@render children()}{/if}
	</a>
{:else}
	<button {type} class={cls} disabled={disabled || loading} {...rest}>
		{#if children}{@render children()}{/if}
	</button>
{/if}
