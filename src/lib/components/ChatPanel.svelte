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

<div class="w-1/2 flex flex-col border-r border-[var(--border-base)]">
	<div class="h-[45px] px-4 border-b border-[var(--border-base)] flex items-center justify-between shrink-0">
		<div class="flex items-center gap-2">
			<h2 class="text-xs font-medium text-[var(--fg-subtle)] uppercase tracking-wide">Chat</h2>
			{#if !app.aiReady}
				<span class="text-[10px] text-[var(--fg-error)]">AI not configured</span>
			{/if}
		</div>
		{#if isActive || isTerminalStatus}
			<div class="flex items-center gap-1.5 text-[10px] {isTerminalStatus ? 'text-[var(--fg-muted)]' : 'text-[var(--fg-interactive)]'} tabular-nums">
				<svg width="10" height="10" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
				<span>{elapsedTotal}</span>
			</div>
		{/if}
	</div>

	<div class="flex-1 relative">
		<div class="absolute inset-0 overflow-y-auto px-4 py-4 space-y-5" bind:this={scrollContainer} onscroll={handleScroll}>
			<EmptyStates {isActive} />

			{#each app.messages as msg (msg.id)}
				<ChatMessage {msg} {elapsedTotal} {isStalled} {stallSeconds} />
			{/each}
		</div>

		<button
			onclick={() => scrollToBottom()}
			class="absolute bottom-4 right-4 w-9 h-9 rounded-full bg-[var(--bg-component)] border border-[var(--border-base)] shadow-lg flex items-center justify-center hover:bg-[var(--bg-component-hover)] transition-all duration-300 cursor-pointer z-10 {showScrollButton ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-90 pointer-events-none'}"
			title="Scroll to bottom"
			aria-label="Scroll to bottom"
		>
			<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 3v8M3 7l4 4 4-4" stroke="var(--fg-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
		</button>
	</div>

	<div class="border-t border-[var(--border-base)] bg-[var(--bg-subtle)]">
		<div class="flex items-center gap-2 p-3">
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
				class="flex-1 bg-[var(--bg-field)] border border-[var(--border-base)] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--border-interactive)] focus:ring-1 focus:ring-[var(--border-interactive)] transition-all placeholder-[var(--fg-disabled)] text-[var(--fg-base)]"
				rows="1"
				disabled={!app.aiReady || !app.currentProject || isActive}
			></textarea>
			<div class="flex items-center gap-1.5">
				{#if isActive}
					<button
						onclick={stopGeneration}
						class="shrink-0 px-3 py-2 bg-[var(--button-danger)] hover:bg-[var(--button-danger-hover)] rounded-lg text-sm font-medium transition-colors cursor-pointer text-[var(--fg-on-color)]"
					>
						Stop
					</button>
				{:else}
					<button
						onclick={() => (app.currentDoc?.id === app.globalConversation?.id) ? sendProjectMessage() : sendMessage()}
						disabled={!app.chatInput.trim() || !app.aiReady || !app.currentProject}
						class="shrink-0 px-3 py-2 bg-[var(--fg-interactive)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors cursor-pointer text-[var(--fg-on-color)]"
					>
						Send
					</button>
				{/if}
			</div>
		</div>
	</div>
</div>
