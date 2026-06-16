<script lang="ts">
	import { WarningIcon } from '$lib/components/ui';
	let { data } = $props();
</script>

<div class="min-h-dvh flex items-center justify-center p-4">
	<div class="w-full max-w-sm text-center bg-[var(--bg-component)] border border-[var(--border-base)] rounded-xl p-8">
		<div class="flex justify-center mb-3 text-[var(--fg-error)]"><WarningIcon size={40} /></div>
		<h1 class="text-lg font-semibold mb-1">Verifikasi gagal</h1>
		<p class="text-sm text-[var(--fg-muted)]">{data.message}</p>
		<a href="/auth/login" class="inline-block mt-4 text-sm text-[var(--fg-interactive)] underline">Ke halaman login</a>
	</div>
</div>
