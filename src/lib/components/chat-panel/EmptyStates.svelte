<script lang="ts">
	import { app } from '$lib/stores/app.svelte';
	import { goto } from '$app/navigation';

	interface Props {
		isActive: boolean;
	}

	let { isActive }: Props = $props();
</script>

{#if !app.currentProject}
	<div class="flex h-full flex-col items-center justify-center px-6 text-center">
		<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border-base)] bg-[var(--bg-component)] shadow-sm">
			<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke="var(--fg-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
		</div>
		<p class="text-sm font-semibold text-[var(--fg-base)]">No project selected</p>
		<p class="mt-1 max-w-[260px] text-xs leading-relaxed text-[var(--fg-muted)]">Select a project from the file panel or create a new one to start generating documents.</p>
		<button
			onclick={() => goto('/app')}
			class="mt-4 rounded-lg bg-[var(--fg-interactive)] px-4 py-2 text-sm font-medium text-[var(--fg-on-color)] transition-colors hover:bg-[var(--fg-interactive-hover)]"
		>
			Go to Projects
		</button>
	</div>
{:else if app.messages.length === 0 && !isActive}
	<div class="flex h-full flex-col items-center justify-center px-6 text-center">
		<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border-base)] bg-[var(--bg-component)] shadow-sm">
			<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="m12 3 2.2 5.2L20 10.5l-5.2 2.2L12 18l-2.8-5.3L4 10.5l5.8-2.3L12 3Z" stroke="var(--fg-interactive)" stroke-width="1.5" stroke-linejoin="round"/></svg>
		</div>
		<p class="text-sm font-semibold text-[var(--fg-base)]">Start a conversation</p>
		<p class="mt-1 max-w-[300px] text-xs leading-relaxed text-[var(--fg-muted)]">Ask the agent to draft, revise, or generate a set of documents for this project.</p>
		<div class="mt-4 grid w-full max-w-[360px] gap-2 text-left">
			<button onclick={() => app.chatInput = 'Generate 3 dokumen ringkas untuk project ini'} class="rounded-lg border border-[var(--border-base)] bg-[var(--bg-component)] px-3 py-2 text-xs text-[var(--fg-subtle)] shadow-sm hover:bg-[var(--bg-component-hover)]">Generate 3 dokumen ringkas</button>
			<button onclick={() => app.chatInput = 'Buat outline dan dokumen pendukung berdasarkan template project'} class="rounded-lg border border-[var(--border-base)] bg-[var(--bg-component)] px-3 py-2 text-xs text-[var(--fg-subtle)] shadow-sm hover:bg-[var(--bg-component-hover)]">Buat outline dan dokumen pendukung</button>
		</div>
	</div>
{/if}
