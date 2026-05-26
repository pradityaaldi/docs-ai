<script lang="ts">
	import { app } from '$lib/stores/app.svelte';
	import { sendMessage, sendProjectMessage, stopGeneration, clearMessages } from '$lib/actions';

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

	function fmtElapsed(ms: number): string {
		const s = Math.floor(ms / 1000);
		if (s < 60) return `${s}s`;
		const m = Math.floor(s / 60);
		const r = s % 60;
		return `${m}m ${r}s`;
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

	const phaseLabel: Record<string, string> = {
		'connecting': 'Connecting to AI…',
		'reconnecting': 'Reconnecting…',
		'chat-streaming': 'Composing reply',
		'chat-saving': 'Reply saved',
		'document-connecting': 'Connecting for document…',
		'document-streaming': 'Generating document',
		'document-saving': 'Saving document',
		'error': 'Error',
		'aborted': 'Stopped'
	};

	function fmtBytes(n: number): string {
		if (n < 1024) return `${n} B`;
		if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
		return `${(n / 1024 / 1024).toFixed(2)} MB`;
	}

	let stallSeconds = $derived(
		app.status.lastChunkAt && isActive
			? Math.floor((now - app.status.lastChunkAt) / 1000)
			: 0
	);
	let isStalled = $derived(stallSeconds >= 10);

	function phaseIcon(phase: string): string {
		if (phase === 'error') return 'error';
		if (phase === 'aborted') return 'stop';
		if (phase === 'document-streaming' || phase === 'document-saving' || phase === 'document-connecting') return 'doc';
		if (phase === 'connecting' || phase === 'reconnecting') return 'plug';
		return 'spin';
	}

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
			{#if !app.activeConnector}
				<span class="text-[10px] text-[var(--fg-error)]">No connector</span>
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

			{#each app.messages as msg, idx (msg.id)}
				{@const isAttached = app.status.attachedMsgId === msg.id && app.status.phase !== 'idle'}
				{@const hasContent = msg.content.trim().length > 0}
				{@const isErrorPhase = app.status.phase === 'error'}
				{@const isAbortedPhase = app.status.phase === 'aborted'}
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

						{#if isAttached && msg.role === 'assistant' && !isErrorPhase && !isAbortedPhase && hasContent}
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
											<span>{section === app.status.activeSection ? '○' : '✓'}</span>
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
											<span>{tr.success ? '✓' : '✗'}</span>
											<span class="truncate">{tr.title}</span>
											{#if tr.error}
												<span class="text-[var(--fg-muted)] text-[10px]">- {tr.error}</span>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						{/if}

						{#if isAttached && msg.role === 'assistant' && isErrorPhase}
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
						{/if}

						{#if isAttached && msg.role === 'assistant' && isAbortedPhase}
							<div class="{hasContent ? 'mt-2.5 pt-2 border-t border-[var(--border-base)]' : ''} flex items-center gap-2 text-[11px] text-[var(--fg-muted)]">
								<svg width="11" height="11" viewBox="0 0 24 24" fill="none" class="shrink-0"><rect x="6" y="6" width="12" height="12" rx="1" stroke="currentColor" stroke-width="2"/></svg>
								<span>Stopped by user</span>
								<span class="ml-auto tabular-nums">{elapsedTotal}</span>
							</div>
						{/if}
					</div>
				</div>
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
				disabled={!app.activeConnector || !app.currentProject || isActive}
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
						disabled={!app.chatInput.trim() || !app.activeConnector || !app.currentProject}
						class="shrink-0 px-3 py-2 bg-[var(--fg-interactive)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors cursor-pointer text-[var(--fg-on-color)]"
					>
						Send
					</button>
				{/if}
			</div>
		</div>
	</div>
</div>
