<script lang="ts">
	import { app } from '$lib/stores/app.svelte';
	import { CheckIcon, CloseIcon, CircleIcon } from '$lib/components/ui';
	import { phaseLabel, phaseIcon, fmtBytes } from './status';

	interface Props {
		hasContent: boolean;
		elapsedTotal: string;
		isStalled: boolean;
		stallSeconds: number;
	}

	let { hasContent, elapsedTotal, isStalled, stallSeconds }: Props = $props();

	let isErrorPhase = $derived(app.status.phase === 'error');
	let isAbortedPhase = $derived(app.status.phase === 'aborted');
</script>

{#if isErrorPhase}
	<div class="{hasContent ? 'mt-2.5 pt-2 border-t border-[var(--border-base)]' : ''} flex items-start gap-2 text-[11px] text-[var(--fg-error)]">
		<svg width="11" height="11" viewBox="0 0 24 24" fill="none" class="shrink-0 mt-0.5"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 7v6M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
		<div class="flex-1 min-w-0">
			<div class="font-medium">{app.status.message || 'Error'}</div>
			{#if app.status.errorMsg}
				<div class="text-[var(--fg-muted)] mt-0.5 break-all">{app.status.errorMsg}</div>
			{/if}
		</div>
		<span class="text-[var(--fg-muted)] tabular-nums shrink-0">{elapsedTotal}</span>
	</div>
{:else if isAbortedPhase}
	<div class="{hasContent ? 'mt-2.5 pt-2 border-t border-[var(--border-base)]' : ''} flex items-center gap-2 text-[11px] text-[var(--fg-muted)]">
		<svg width="11" height="11" viewBox="0 0 24 24" fill="none" class="shrink-0"><rect x="6" y="6" width="12" height="12" rx="1" stroke="currentColor" stroke-width="2"/></svg>
		<span>Stopped by user</span>
		<span class="ml-auto tabular-nums">{elapsedTotal}</span>
	</div>
{:else if hasContent}
	<div class="mt-2.5 pt-2 border-t border-[var(--border-base)] flex items-center gap-2 text-[11px] text-[var(--fg-subtle)]">
		{#if phaseIcon(app.status.phase) === 'spin'}
			<svg width="11" height="11" viewBox="0 0 24 24" fill="none" class="animate-spin shrink-0"><path d="M12 4v2M12 18v2M4 12H2M22 12h-2M19.07 4.93l-1.41 1.41M6.34 17.66l-1.41 1.41M19.07 19.07l-1.41-1.41M6.34 6.34l-1.41-1.41" stroke="var(--fg-interactive)" stroke-width="2" stroke-linecap="round"/></svg>
		{:else if phaseIcon(app.status.phase) === 'doc'}
			<svg width="11" height="11" viewBox="0 0 24 24" fill="none" class="animate-pulse shrink-0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6" stroke="var(--fg-interactive)" stroke-width="2" stroke-linejoin="round"/></svg>
		{:else if phaseIcon(app.status.phase) === 'plug'}
			<svg width="11" height="11" viewBox="0 0 24 24" fill="none" class="animate-pulse shrink-0"><path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0z M12 18v4" stroke="var(--fg-interactive)" stroke-width="2" stroke-linecap="round"/></svg>
		{/if}
		<span>{phaseLabel[app.status.phase] || 'Working…'}</span>
		{#if app.status.thinking}
			<span class="text-[var(--fg-muted)]">·</span>
			<span class="text-[var(--fg-interactive-hover)]">thinking</span>
		{:else if app.status.activeSection}
			<span class="text-[var(--fg-muted)]">·</span>
			<span class="text-[var(--fg-interactive-hover)] truncate">{app.status.activeSection}</span>
		{:else if app.status.bytesReceived > 0 && app.status.phase === 'document-streaming'}
			<span class="text-[var(--fg-muted)]">·</span>
			<span class="text-[var(--fg-muted)] tabular-nums">{fmtBytes(app.status.bytesReceived)}</span>
		{/if}
		{#if isStalled}
			<span class="text-[var(--fg-muted)]">·</span>
			<span class="text-[var(--fg-warning, var(--fg-error))]">stalled {stallSeconds}s</span>
		{/if}
		<span class="ml-auto text-[var(--fg-muted)] tabular-nums shrink-0">{elapsedTotal}</span>
	</div>

	{#if app.status.sections.length > 0 && app.status.phase === 'document-streaming'}
		<div class="mt-2 space-y-1">
			{#each app.status.sections as section}
				<div class="flex items-center gap-2 text-[11px] {section === app.status.activeSection ? 'text-[var(--fg-interactive)] font-medium' : 'text-[var(--tag-green-text)]'}">
					{#if section === app.status.activeSection}<CircleIcon size={11} class="shrink-0" />{:else}<CheckIcon size={11} class="shrink-0" />{/if}
					<span class="truncate">{section}</span>
				</div>
			{/each}
		</div>
	{/if}

	{#if app.status.toolResults.length > 0}
		<div class="mt-2 space-y-1.5">
			<div class="text-[11px] font-medium text-[var(--fg-subtle)] flex items-center gap-1.5">
				<svg width="11" height="11" viewBox="0 0 24 24" fill="none" class="shrink-0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6" stroke="var(--fg-interactive)" stroke-width="2" stroke-linejoin="round"/></svg>
				Created documents
				{#if app.status.toolPhase === 'tools'}
					<span class="text-[var(--fg-muted)]">({app.status.toolCallsCompleted} done)</span>
				{/if}
			</div>
			{#each app.status.toolResults as tr}
				<div class="flex items-center gap-2 text-[11px] {tr.success ? 'text-[var(--tag-green-text)]' : 'text-[var(--fg-error)]'}">
					{#if tr.success}<CheckIcon size={11} class="shrink-0" />{:else}<CloseIcon size={11} class="shrink-0" />{/if}
					<span class="truncate">{tr.title}</span>
					{#if tr.error}
						<span class="text-[var(--fg-muted)] text-[10px]">- {tr.error}</span>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
{/if}
