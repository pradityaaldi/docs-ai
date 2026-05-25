<script lang="ts">
	interface Props {
		variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
		class?: string;
		children?: import('svelte').Snippet;
	}

	let { variant = 'neutral', class: extraClass = '', children }: Props = $props();

	const variantClasses: Record<string, string> = {
		success: 'bg-[var(--success-subtle)] text-[var(--success)]',
		warning: 'bg-[var(--warning-subtle)] text-[var(--warning)]',
		danger: 'bg-[var(--danger-subtle)] text-[var(--danger)]',
		info: 'bg-[var(--accent-subtle)] text-[var(--accent-text)]',
		neutral: 'bg-[var(--bg-hover)] text-[var(--text-secondary)]'
	};
</script>

<span class="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full {variantClasses[variant]} {extraClass}">
	{#if children}
		{@render children()}
	{/if}
</span>
