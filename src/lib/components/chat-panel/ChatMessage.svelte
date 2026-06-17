<script lang="ts">
	import { app } from '$lib/stores/app.svelte';
	import { toggleMessageSelected } from '$lib/actions';
	import { phaseLabel, fmtBytes } from './status';
	import { CheckIcon } from '$lib/components/ui/icons';
	import MessageStatus from './MessageStatus.svelte';

	interface Props {
		msg: { id: string; role: string; content: string };
		elapsedTotal: string;
		isStalled: boolean;
		stallSeconds: number;
	}

	let { msg, elapsedTotal, isStalled, stallSeconds }: Props = $props();

	let isAttached = $derived(app.status.attachedMsgId === msg.id && app.status.phase !== 'idle');
	let hasContent = $derived(msg.content.trim().length > 0);
	let selected = $derived(app.selectedMsgIds.includes(msg.id));
	let selectable = $derived(app.selectMode && hasContent);

	let copied = $state(false);
	async function copyOutput() {
		try {
			await navigator.clipboard.writeText(msg.content);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch { /* clipboard unavailable */ }
	}
</script>

<div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
	<div class="{msg.role === 'user' ? 'max-w-[82%]' : 'w-full'}">
		<div class="mb-1 flex items-center gap-2 px-1">
			{#if selectable}
				<input
					type="checkbox"
					checked={selected}
					onchange={() => toggleMessageSelected(msg.id)}
					class="h-3.5 w-3.5 cursor-pointer accent-[var(--fg-interactive)]"
					aria-label="Pilih pesan untuk disalin"
				/>
			{/if}
			<span class="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border-base)] bg-[var(--bg-component)] text-[10px] font-semibold text-[var(--fg-muted)]">
				{msg.role === 'user' ? 'U' : 'A'}
			</span>
			<span class="text-[11px] font-medium text-[var(--fg-muted)]">{msg.role === 'user' ? 'You' : 'Assistant'}</span>
		</div>

		<div class="{msg.role === 'user'
			? 'rounded-2xl rounded-tr-md bg-[var(--fg-interactive)] px-4 py-2.5 text-[var(--fg-on-color)] shadow-sm'
			: 'rounded-xl border border-[var(--border-base)] bg-[var(--bg-component)] text-[var(--fg-base)] shadow-sm'} {selected ? 'ring-2 ring-[var(--fg-interactive)] ring-offset-2 ring-offset-[var(--bg-base)]' : ''}">

			{#if msg.role === 'assistant'}
				{#if isAttached && (app.status.toolCallCurrent || app.status.toolResults.length > 0)}
					<div class="border-b border-[var(--border-base)] p-3">
						<div class="mb-2 flex items-center justify-between">
							<div class="flex items-center gap-2 text-xs font-medium text-[var(--fg-subtle)]">
								<span class="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--bg-subtle)]">
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.3-3.3a5 5 0 0 1-6.6 6.6L7 20l-3-3 7.4-7.4A5 5 0 0 1 18 3l-3.3 3.3Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
								</span>
								Tool calls
							</div>
							<span class="text-[11px] tabular-nums text-[var(--fg-muted)]">{app.status.toolCallsCompleted} done</span>
						</div>
						<div class="space-y-1.5">
							{#if app.status.toolCallCurrent}
								<div class="flex items-center gap-2 rounded-lg border border-[var(--border-base)] bg-[var(--bg-subtle)] px-3 py-2 text-xs text-[var(--fg-subtle)]">
									<span class="h-2 w-2 animate-pulse rounded-full bg-[var(--fg-interactive)]"></span>
									<span class="truncate">Creating {app.status.toolCallCurrent}</span>
								</div>
							{/if}
							{#each app.status.toolResults as result}
								<div class="flex items-center gap-2 rounded-lg border border-[var(--border-base)] bg-[var(--bg-subtle)] px-3 py-2 text-xs">
									<span class="h-2 w-2 rounded-full {result.success ? 'bg-[var(--tag-green-text)]' : 'bg-[var(--tag-red-text)]'}"></span>
									<span class="min-w-0 flex-1 truncate text-[var(--fg-subtle)]">{result.title || 'Document'}</span>
									<span class="{result.success ? 'text-[var(--tag-green-text)]' : 'text-[var(--tag-red-text)]'}">{result.success ? 'created' : 'failed'}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<div class="p-4">
					{#if hasContent}
						<div class="whitespace-pre-wrap text-sm leading-7">{msg.content}</div>
					{:else if isAttached}
						<div class="flex flex-wrap items-center gap-2 text-xs text-[var(--fg-subtle)]">
							<span class="flex gap-1">
								<span class="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--fg-muted)]"></span>
								<span class="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--fg-muted)]" style="animation-delay: 0.1s"></span>
								<span class="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--fg-muted)]" style="animation-delay: 0.2s"></span>
							</span>
							<span>{phaseLabel[app.status.phase] || 'Working...'}</span>
							{#if app.status.thinking}
								<span class="text-[var(--fg-muted)]">·</span>
								<span class="text-[var(--fg-interactive-hover)]">thinking</span>
							{:else if app.status.bytesReceived > 0}
								<span class="text-[var(--fg-muted)]">·</span>
								<span class="tabular-nums text-[var(--fg-muted)]">{fmtBytes(app.status.bytesReceived)}</span>
							{/if}
							{#if isStalled}
								<span class="text-[var(--fg-muted)]">·</span>
								<span class="text-[var(--fg-error)]">stalled {stallSeconds}s</span>
							{/if}
							<span class="ml-auto tabular-nums text-[var(--fg-muted)]">{elapsedTotal}</span>
						</div>
					{/if}

					{#if isAttached}
						<MessageStatus {hasContent} {elapsedTotal} {isStalled} {stallSeconds} />
					{/if}

					{#if hasContent && !isAttached && !app.selectMode}
						<div class="mt-2 flex border-t border-[var(--border-base)] pt-2">
							<button
								onclick={copyOutput}
								class="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-base-hover)] hover:text-[var(--fg-base)]"
								title="Copy output"
							>
								{#if copied}
									<CheckIcon size={13} class="text-[var(--tag-green-text)]" />
									<span>Copied</span>
								{:else}
									<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.7"/></svg>
									<span>Copy</span>
								{/if}
							</button>
						</div>
					{/if}
				</div>
			{:else}
				<div class="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>
			{/if}
		</div>
	</div>
</div>
