<script lang="ts">
	import { app } from '$lib/stores/app.svelte';
	import { phaseLabel, fmtBytes } from './status';
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
</script>

<div class="flex flex-col {msg.role === 'user' ? 'items-end' : 'items-start'} gap-1">
	<span class="text-[10px] font-medium text-[var(--fg-muted)] uppercase tracking-wider px-1">{msg.role === 'user' ? 'You' : 'Assistant'}</span>
	<div class="max-w-[85%] {msg.role === 'user'
		? 'bg-[var(--fg-interactive)] text-[var(--fg-on-color)] rounded-2xl rounded-br-sm'
		: 'bg-[var(--bg-component)] text-[var(--fg-base)] border border-[var(--border-base)] rounded-2xl rounded-bl-sm'} px-4 py-2.5">

		{#if hasContent}
			<div class="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
		{:else if isAttached}
			<div class="flex items-center gap-2 text-xs text-[var(--fg-subtle)] flex-wrap">
				<span class="flex gap-1">
					<span class="w-1.5 h-1.5 rounded-full bg-[var(--fg-muted)] animate-bounce"></span>
					<span class="w-1.5 h-1.5 rounded-full bg-[var(--fg-muted)] animate-bounce" style="animation-delay: 0.1s"></span>
					<span class="w-1.5 h-1.5 rounded-full bg-[var(--fg-muted)] animate-bounce" style="animation-delay: 0.2s"></span>
				</span>
				<span>{phaseLabel[app.status.phase] || 'Working…'}</span>
				{#if app.status.thinking}
					<span class="text-[var(--fg-muted)]">·</span>
					<span class="text-[var(--fg-interactive-hover)]">thinking</span>
				{:else if app.status.bytesReceived > 0}
					<span class="text-[var(--fg-muted)]">·</span>
					<span class="text-[var(--fg-muted)] tabular-nums">{fmtBytes(app.status.bytesReceived)}</span>
				{/if}
				{#if isStalled}
					<span class="text-[var(--fg-muted)]">·</span>
					<span class="text-[var(--fg-error)]">stalled {stallSeconds}s</span>
				{/if}
				<span class="ml-auto text-[var(--fg-muted)] tabular-nums">{elapsedTotal}</span>
			</div>
		{/if}

		{#if isAttached && msg.role === 'assistant'}
			<MessageStatus {hasContent} {elapsedTotal} {isStalled} {stallSeconds} />
		{/if}
	</div>
</div>
