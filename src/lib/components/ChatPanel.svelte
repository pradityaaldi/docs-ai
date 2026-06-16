<script lang="ts">
	import { app } from '$lib/stores/app.svelte';
	import { sendMessage, sendProjectMessage, stopGeneration, clearMessages } from '$lib/actions';
	import { fmtElapsed } from './chat-panel/status';
	import ChatMessage from './chat-panel/ChatMessage.svelte';
	import EmptyStates from './chat-panel/EmptyStates.svelte';

	let scrollContainer = $state<HTMLDivElement>();
	let autoScroll = $state(true);
	let showScrollButton = $state(false);
	let textareaRef = $state<HTMLTextAreaElement>();
	let now = $state(Date.now());

	$effect(() => {
		const i = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(i);
	});

	$effect(() => {
		if (!app.chatInput && textareaRef) {
			textareaRef.style.height = 'auto';
		}
	});

	function handleScroll() {
		const el = scrollContainer;
		if (!el) return;
		const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
		autoScroll = atBottom;
		showScrollButton = !atBottom;
	}

	function scrollToBottom(smooth = true) {
		const el = scrollContainer;
		if (!el) return;
		autoScroll = true;
		showScrollButton = false;

		if (!smooth) {
			el.scrollTo({ top: el.scrollHeight, behavior: 'instant' });
			return;
		}

		const start = el.scrollTop;
		const end = el.scrollHeight - el.clientHeight;
		const distance = end - start;
		const duration = 400;
		const startTime = performance.now();

		function easeOutCubic(t: number): number {
			return 1 - Math.pow(1 - t, 3);
		}

		function animate(t: number) {
			const elapsed = t - startTime;
			const progress = Math.min(elapsed / duration, 1);
			el!.scrollTop = start + distance * easeOutCubic(progress);
			if (progress < 1) requestAnimationFrame(animate);
		}

		requestAnimationFrame(animate);
	}

	async function tick() {
		await new Promise((r) => requestAnimationFrame(r));
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			const val = app.chatInput.trim();
			if (val === '/clear') {
				clearMessages();
				app.chatInput = '';
			} else if (val === '/stop') {
				stopGeneration();
				app.chatInput = '';
			} else if (app.currentDoc?.id === app.globalConversation?.id) {
				sendProjectMessage();
			} else if (app.currentDoc) {
				sendMessage();
			} else if (app.currentProject) {
				sendProjectMessage();
			}
		}
	}

	let elapsedTotal = $derived(
		app.status.startedAt
			? fmtElapsed((app.status.finishedAt ?? now) - app.status.startedAt)
			: '0s'
	);

	let isActive = $derived(
		app.status.phase !== 'idle' &&
		app.status.phase !== 'error' &&
		app.status.phase !== 'aborted'
	);
	let isTerminalStatus = $derived(
		app.status.phase === 'error' || app.status.phase === 'aborted'
	);

	let stallSeconds = $derived(
		app.status.lastChunkAt && isActive
			? Math.floor((now - app.status.lastChunkAt) / 1000)
			: 0
	);
	let isStalled = $derived(stallSeconds >= 10);

	let _msgsLen = $derived(app.messages.length);
	let _phase = $derived(app.status.phase);
	let _msg = $derived(app.messages.length > 0 ? app.messages[app.messages.length - 1].content.length : 0);
	$effect(() => {
		_msgsLen;
		_phase;
		_msg;
		if (autoScroll) {
			tick().then(() => scrollToBottom(_msgsLen <= 1));
		}
	});
</script>

<div class="flex w-[42%] min-w-[420px] flex-col border-r border-[var(--border-base)] bg-[var(--bg-base)]">
	<div class="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border-base)] px-4">
		<div class="flex items-center gap-2">
			<div class="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border-base)] bg-[var(--bg-subtle)]">
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>
			</div>
			<div>
				<h2 class="text-sm font-semibold leading-none text-[var(--fg-base)]">Conversation</h2>
				<p class="mt-1 text-[11px] text-[var(--fg-muted)]">Document generation agent</p>
			</div>
			{#if !app.aiReady}
				<span class="rounded-full border border-[var(--tag-red-border)] bg-[var(--tag-red-bg)] px-2 py-0.5 text-[10px] text-[var(--tag-red-text)]">AI not configured</span>
			{/if}
		</div>
		{#if isActive || isTerminalStatus}
			<div class="flex items-center gap-1.5 rounded-full border border-[var(--border-base)] bg-[var(--bg-subtle)] px-2.5 py-1 text-[11px] {isTerminalStatus ? 'text-[var(--fg-muted)]' : 'text-[var(--fg-interactive)]'} tabular-nums">
				<svg width="10" height="10" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
				<span>{elapsedTotal}</span>
			</div>
		{/if}
	</div>

	<div class="relative flex-1 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:28px_28px]">
		<div class="absolute inset-0 space-y-5 overflow-y-auto px-5 py-5" bind:this={scrollContainer} onscroll={handleScroll}>
			<EmptyStates {isActive} />

			{#each app.messages as msg (msg.id)}
				<ChatMessage {msg} {elapsedTotal} {isStalled} {stallSeconds} />
			{/each}
		</div>

		<button
			onclick={() => scrollToBottom()}
			class="absolute bottom-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-base)] bg-[var(--bg-component)] shadow-lg transition-all duration-300 hover:bg-[var(--bg-component-hover)] {showScrollButton ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-90 pointer-events-none'}"
			title="Scroll to bottom"
			aria-label="Scroll to bottom"
		>
			<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 3v8M3 7l4 4 4-4" stroke="var(--fg-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
		</button>
	</div>

	<div class="border-t border-[var(--border-base)] bg-[var(--bg-base)] p-4">
		<div class="rounded-xl border border-[var(--border-base)] bg-[var(--bg-component)] shadow-sm">
			<textarea
				bind:this={textareaRef}
				bind:value={app.chatInput}
				onkeydown={handleKeydown}
				oninput={(e) => {
					const t = e.currentTarget;
					t.style.height = 'auto';
					t.style.height = Math.min(t.scrollHeight, 160) + 'px';
				}}
				placeholder={isActive ? 'AI is working...' : app.currentProject ? (app.currentDoc ? 'Type a message...' : 'Describe what you want to create...') : 'Select a project first'}
				class="block max-h-40 min-h-[78px] w-full resize-none rounded-t-xl bg-transparent px-3.5 py-3 text-sm text-[var(--fg-base)] placeholder-[var(--fg-disabled)] outline-none transition-all"
				rows="1"
				disabled={!app.aiReady || !app.currentProject || isActive}
			></textarea>
			<div class="flex items-center justify-between gap-2 border-t border-[var(--border-base)] px-2.5 py-2">
				<div class="flex items-center gap-1.5">
					<span class="rounded-md border border-[var(--border-base)] bg-[var(--bg-subtle)] px-2 py-1 text-[11px] text-[var(--fg-muted)]">Enter</span>
					<span class="text-[11px] text-[var(--fg-muted)]">send</span>
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
						onclick={() => (app.currentDoc?.id === app.globalConversation?.id) ? sendProjectMessage() : sendMessage()}
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
</div>
