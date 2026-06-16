<script lang="ts">
	interface Props {
		variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
		class?: string;
		children?: import('svelte').Snippet;
	}

	let { variant = 'neutral', class: extraClass = '', children }: Props = $props();

	const variantClasses: Record<string, string> = {
		success: 'bg-[var(--tag-green-bg)] text-[var(--tag-green-text)]',
		warning: 'bg-[var(--tag-orange-bg)] text-[var(--tag-orange-text)]',
		danger: 'bg-[var(--tag-red-bg)] text-[var(--tag-red-text)]',
		info: 'bg-[var(--tag-blue-bg)] text-[var(--tag-blue-text)]',
		neutral: 'bg-[var(--tag-neutral-bg)] text-[var(--tag-neutral-text)]'
	};
</script>

<span class="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full {variantClasses[variant]} {extraClass}">
	{#if children}
		{@render children()}
	{/if}
</span>
