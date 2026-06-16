<script lang="ts">
	interface Tab {
		key: string;
		label: string;
	}

	interface Props {
		tabs: Tab[];
		active?: string;
		class?: string;
	}

	let { tabs, active = $bindable(''), class: extra = '' }: Props = $props();

	const activeCls = 'bg-[var(--fg-interactive)] text-[var(--fg-on-color)]';
	const idleCls =
		'bg-[var(--bg-component)] border border-[var(--border-base)] text-[var(--fg-subtle)] hover:bg-[var(--bg-base-hover)]';
</script>

<div class="flex gap-2 {extra}">
	{#each tabs as t (t.key)}
		<button
			onclick={() => (active = t.key)}
			class="px-3 py-1.5 rounded-full text-sm transition-colors {active === t.key ? activeCls : idleCls}"
		>
			{t.label}
		</button>
	{/each}
</div>
