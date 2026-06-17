<script lang="ts">
	import { app, type MentionItem } from '$lib/stores/app.svelte';
	import { sendProjectMessage, stopGeneration, clearMessages, mentionItems } from '$lib/actions';
	import { CloseIcon } from '$lib/components/ui/icons';
	import MentionSuggest from './MentionSuggest.svelte';

	interface Props {
		isActive: boolean;
	}
	let { isActive }: Props = $props();

	let textareaRef = $state<HTMLTextAreaElement>();

	// @-mention autocomplete state
	let mqOpen = $state(false);
	let mqQuery = $state('');
	let mqStart = $state(0); // index of the triggering "@"
	let mqIndex = $state(0);

	let mqItems = $derived(
		mqOpen
			? mentionItems()
					.filter((it) => it.title.toLowerCase().includes(mqQuery.toLowerCase()))
					.slice(0, 8)
			: []
	);

	$effect(() => {
		// keep selection in range as the filtered list changes
		if (mqIndex >= mqItems.length) mqIndex = 0;
	});

	$effect(() => {
		if (!app.chatInput && textareaRef) textareaRef.style.height = 'auto';
	});

	function autosize(t: HTMLTextAreaElement) {
		t.style.height = 'auto';
		t.style.height = Math.min(t.scrollHeight, 160) + 'px';
	}

	// Detect an "@token" immediately before the caret to drive suggestions.
	function detectMention() {
		const el = textareaRef;
		if (!el) return;
		const caret = el.selectionStart ?? app.chatInput.length;
		const upto = app.chatInput.slice(0, caret);
		const m = upto.match(/(?:^|\s)@([^\s@]*)$/);
		if (m) {
			mqQuery = m[1];
			mqStart = caret - m[1].length - 1;
			mqOpen = true;
		} else {
			mqOpen = false;
		}
	}

	function accept(item: MentionItem) {
		const el = textareaRef;
		const caret = el?.selectionStart ?? app.chatInput.length;
		const before = app.chatInput.slice(0, mqStart);
		const after = app.chatInput.slice(caret);
		const label = `@${item.title} `;
		app.chatInput = before + label + after;
		if (!app.mentions.some((m) => m.id === item.id)) app.mentions = [...app.mentions, item];
		mqOpen = false;
		const pos = (before + label).length;
		requestAnimationFrame(() => {
			el?.focus();
			el?.setSelectionRange(pos, pos);
			if (el) autosize(el);
		});
	}

	function removeMention(id: string) {
		app.mentions = app.mentions.filter((m) => m.id !== id);
	}

	function onKeydown(e: KeyboardEvent) {
		if (mqOpen && mqItems.length) {
			if (e.key === 'ArrowDown') { e.preventDefault(); mqIndex = Math.min(mqItems.length - 1, mqIndex + 1); return; }
			if (e.key === 'ArrowUp') { e.preventDefault(); mqIndex = Math.max(0, mqIndex - 1); return; }
			if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); accept(mqItems[mqIndex]); return; }
			if (e.key === 'Escape') { e.preventDefault(); mqOpen = false; return; }
		}
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			const val = app.chatInput.trim();
			if (val === '/clear') { clearMessages(); app.chatInput = ''; }
			else if (val === '/stop') { stopGeneration(); app.chatInput = ''; }
			else if (app.currentProject) sendProjectMessage();
		}
	}
</script>

<div class="border-t border-[var(--border-base)] bg-[var(--bg-base)] p-4">
	<div class="relative rounded-xl border border-[var(--border-base)] bg-[var(--bg-component)] shadow-sm">
		<MentionSuggest items={mqItems} activeIndex={mqIndex} onpick={accept} />

		{#if app.mentions.length}
			<div class="flex flex-wrap gap-1.5 border-b border-[var(--border-base)] px-2.5 pt-2.5">
				{#each app.mentions as m (m.id)}
					<span class="inline-flex items-center gap-1 rounded-md border border-[var(--border-base)] bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[11px] text-[var(--fg-muted)]">
						@{m.title}
						<button onclick={() => removeMention(m.id)} class="text-[var(--fg-disabled)] hover:text-[var(--fg-error)]" aria-label="Remove mention">
							<CloseIcon size={11} />
						</button>
					</span>
				{/each}
			</div>
		{/if}

		<textarea
			bind:this={textareaRef}
			bind:value={app.chatInput}
			onkeydown={onKeydown}
			oninput={(e) => { autosize(e.currentTarget); detectMention(); }}
			onclick={detectMention}
			placeholder={isActive ? 'AI is working...' : app.currentProject ? 'Describe what you want… (type @ to mention a file)' : 'Select a project first'}
			class="block max-h-40 min-h-[78px] w-full resize-none rounded-t-xl bg-transparent px-3.5 py-3 text-sm text-[var(--fg-base)] placeholder-[var(--fg-disabled)] outline-none transition-all"
			rows="1"
			disabled={!app.aiReady || !app.currentProject || isActive}
		></textarea>

		<div class="flex items-center justify-between gap-2 border-t border-[var(--border-base)] px-2.5 py-2">
			<div class="flex items-center gap-1.5">
				<span class="rounded-md border border-[var(--border-base)] bg-[var(--bg-subtle)] px-2 py-1 text-[11px] text-[var(--fg-muted)]">@</span>
				<span class="text-[11px] text-[var(--fg-muted)]">mention file</span>
			</div>
			{#if isActive}
				<button
					onclick={stopGeneration}
					class="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[var(--button-danger)] px-3 py-2 text-sm font-medium text-[var(--fg-on-color)] transition-colors hover:bg-[var(--button-danger-hover)]"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="7" width="10" height="10" rx="1"/></svg>
					Stop
				</button>
			{:else}
				<button
					onclick={sendProjectMessage}
					disabled={!app.chatInput.trim() || !app.aiReady || !app.currentProject}
					class="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[var(--fg-interactive)] px-3 py-2 text-sm font-medium text-[var(--fg-on-color)] transition-colors hover:bg-[var(--fg-interactive-hover)] disabled:cursor-not-allowed disabled:opacity-40"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="m5 12 14-7-7 14-2-5-5-2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
					Send
				</button>
			{/if}
		</div>
	</div>
</div>
