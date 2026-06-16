<script lang="ts">
	import { confirmStore } from '$lib/stores/confirm.svelte';
	import Button from './Button.svelte';
	import Card from './Card.svelte';
	import { WarningIcon } from './icons';

	function onKeydown(e: KeyboardEvent) {
		if (!confirmStore.open) return;
		if (e.key === 'Escape') confirmStore.cancel();
		if (e.key === 'Enter') confirmStore.confirm();
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if confirmStore.open}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--bg-overlay)] p-4"
		onclick={() => confirmStore.cancel()}
		role="presentation"
	>
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div onclick={(e) => e.stopPropagation()} role="presentation" class="w-full max-w-sm">
			<Card padding="lg">
				<div class="flex items-start gap-3">
					{#if confirmStore.variant === 'danger'}
						<span class="mt-0.5 shrink-0 text-[var(--fg-error)]"><WarningIcon size={22} /></span>
					{/if}
					<div class="min-w-0">
						<h2 class="text-lg font-semibold">{confirmStore.title}</h2>
						<p class="mt-1 text-sm text-[var(--fg-muted)]">{confirmStore.message}</p>
					</div>
				</div>
				<div class="mt-5 flex justify-end gap-2">
					<Button variant="neutral" size="md" onclick={() => confirmStore.cancel()}>
						{confirmStore.cancelText}
					</Button>
					<Button
						variant={confirmStore.variant === 'danger' ? 'danger' : 'primary'}
						size="md"
						onclick={() => confirmStore.confirm()}
					>
						{confirmStore.confirmText}
					</Button>
				</div>
			</Card>
		</div>
	</div>
{/if}
