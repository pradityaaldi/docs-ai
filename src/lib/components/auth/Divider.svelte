<script lang="ts">
	let { label = 'atau' }: { label?: string } = $props();
</script>

<div class="flex items-center gap-3 my-4">
	<div class="flex-1 h-px bg-[var(--border-base)]"></div>
	<span class="text-xs text-[var(--fg-muted)]">{label}</span>
	<div class="flex-1 h-px bg-[var(--border-base)]"></div>
</div>
