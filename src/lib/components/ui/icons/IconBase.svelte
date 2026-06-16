<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { SVGAttributes } from 'svelte/elements';

	interface Props extends SVGAttributes<SVGElement> {
		size?: number | string;
		class?: string;
		children: Snippet;
	}

	let { size = 16, class: cls = '', children, ...rest }: Props = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	class={cls}
	{...rest}
>
	{@render children()}
</svg>
