<script lang="ts">
	import { app } from '$lib/stores/app.svelte';
	import { clearMessages } from '$lib/actions';
	import { confirmAction } from '$lib/stores/confirm.svelte';
	import { estimateTokens, CONTEXT_WINDOW, fmtTokens } from '$lib/shared/tokens';
	import { TrashIcon } from '$lib/components/ui/icons';

	// Rough system-prompt overhead so the meter isn't misleadingly empty.
	const BASE_OVERHEAD = 700;

	let used = $derived(
		BASE_OVERHEAD +
			estimateTokens(app.chatInput) +
			app.messages.reduce((n, m) => n + estimateTokens(m.content) + 4, 0)
	);
	let pct = $derived(Math.min(100, Math.round((used / CONTEXT_WINDOW) * 100)));
	let tone = $derived(pct >= 90 ? 'var(--fg-error)' : pct >= 70 ? 'var(--tag-amber-text, #d97706)' : 'var(--fg-interactive)');
	let empty = $derived(app.messages.length === 0);

	async function clear() {
		if (empty) return;
		const ok = await confirmAction({
			title: 'Clear context',
			message: 'Hapus seluruh percakapan project ini? Konteks akan kosong dan tidak bisa dikembalikan.',
			confirmText: 'Clear'
		});
		if (ok) await clearMessages();
	}
</script>

<div class="flex items-center gap-2">
	<div
		class="flex items-center gap-2 rounded-full border border-[var(--border-base)] bg-[var(--bg-subtle)] px-2.5 py-1 text-[11px] tabular-nums text-[var(--fg-muted)]"
		title={`Konteks: ${used.toLocaleString()} / ${CONTEXT_WINDOW.toLocaleString()} token (${pct}%)`}
	>
		<span>{fmtTokens(used)}</span>
		<div class="h-1 w-12 overflow-hidden rounded-full bg-[var(--bg-base-hover)]">
			<div class="h-full rounded-full transition-all" style="width: {pct}%; background: {tone};"></div>
		</div>
		<span class="text-[var(--fg-disabled)]">{pct}%</span>
	</div>
	<button
		onclick={clear}
		disabled={empty}
		class="rounded-md p-1.5 text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-base-hover)] hover:text-[var(--fg-error)] disabled:cursor-not-allowed disabled:opacity-40"
		title="Clear context"
		aria-label="Clear context"
	>
		<TrashIcon size={14} />
	</button>
</div>
