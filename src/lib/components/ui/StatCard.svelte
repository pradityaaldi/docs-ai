<script lang="ts">
	interface Props {
		label: string;
		value: string | number;
		class?: string;
	}

	let { label, value, class: extra = '' }: Props = $props();
</script>

<div class="bg-[var(--bg-component)] border border-[var(--border-base)] rounded-lg p-4 {extra}">
	<div class="text-xs text-[var(--fg-muted)]">{label}</div>
	<div class="text-xl font-bold">{value}</div>
</div>
