<script lang="ts">
	import { app } from '$lib/stores/app.svelte';

	interface Props {
		isActive: boolean;
	}

	let { isActive }: Props = $props();
</script>

{#if !app.currentProject}
	<div class="flex flex-col items-center justify-center h-full text-center px-6">
		<div class="w-12 h-12 rounded-xl bg-[var(--bg-component)] border border-[var(--border-base)] flex items-center justify-center mb-4">
			<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke="var(--fg-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
		</div>
		<p class="text-sm font-medium text-[var(--fg-subtle)]">No project selected</p>
		<p class="text-xs text-[var(--fg-muted)] mt-1 max-w-[260px] leading-relaxed">Select a project from the sidebar or create a new one to start generating documents.</p>
		<button
			onclick={() => app.sidebarView = 'projects'}
			class="mt-4 px-4 py-2 rounded-lg bg-[var(--fg-interactive)] hover:opacity-90 text-sm font-medium text-[var(--fg-on-color)] cursor-pointer transition-opacity"
		>
			Go to Projects
		</button>
	</div>
{:else if app.messages.length === 0 && !isActive}
	<div class="flex flex-col items-center justify-center h-full text-center px-6">
		<div class="w-12 h-12 rounded-xl bg-[var(--bg-component)] border border-[var(--border-base)] flex items-center justify-center mb-4">
			<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 8v4l3 3" stroke="var(--fg-interactive)" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="12" r="9" stroke="var(--fg-interactive)" stroke-width="1.5"/></svg>
		</div>
		<p class="text-sm font-medium text-[var(--fg-subtle)]">Start a conversation</p>
		<p class="text-xs text-[var(--fg-muted)] mt-1 max-w-[280px] leading-relaxed">Describe what you want to create. The AI can generate multiple documents at once — try asking for "5 documents about vegetables" or "3 reports on fruit".</p>
		<div class="flex items-center gap-2 mt-4">
			<kbd class="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-component)] border border-[var(--border-base)] text-[var(--fg-muted)]">/clear to reset</kbd>
			<kbd class="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-component)] border border-[var(--border-base)] text-[var(--fg-muted)]">/stop to cancel</kbd>
		</div>
	</div>
{/if}
