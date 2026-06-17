<script lang="ts">
	import { app } from '$lib/stores/app.svelte';
	import { renameProject, toggleSelectMode, selectAllMessages, clearSelection, copySelectedMessages } from '$lib/actions';
	import { PencilIcon, CheckIcon, CloseIcon } from '$lib/components/ui/icons';
	import { fmtElapsed } from './chat-panel/status';
	import ChatMessage from './chat-panel/ChatMessage.svelte';
	import EmptyStates from './chat-panel/EmptyStates.svelte';
	import ContextMeter from './chat-panel/ContextMeter.svelte';
	import Composer from './chat-panel/Composer.svelte';

	let copiedSel = $state(false);
	async function copySelection() {
		const ok = await copySelectedMessages();
		if (ok) { copiedSel = true; setTimeout(() => (copiedSel = false), 1500); }
	}
	let selCount = $derived(app.selectedMsgIds.length);
	let hasMessages = $derived(app.messages.some((m) => m.content.trim().length > 0));

	let scrollContainer = $state<HTMLDivElement>();
	let autoScroll = $state(true);

	// Inline project rename in the header.
	let editingName = $state(false);
	let nameDraft = $state('');

	function startEditName() {
		if (!app.currentProject) return;
		nameDraft = app.currentProject.name;
		editingName = true;
	}
	async function saveName() {
		if (!editingName || !app.currentProject) return;
		editingName = false;
		await renameProject(app.currentProject.id, nameDraft);
	}
	function nameKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			saveName();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			editingName = false;
		}
	}
	function focusOnMount(node: HTMLInputElement) {
		node.focus();
		node.select();
	}
	let showScrollButton = $state(false);
	let now = $state(Date.now());

	$effect(() => {
		const i = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(i);
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
			{#if editingName}
				<input
					bind:value={nameDraft}
					onkeydown={nameKeydown}
					onblur={saveName}
					use:focusOnMount
					maxlength="120"
					class="w-56 rounded-md border border-[var(--border-base)] bg-[var(--bg-component)] px-2 py-1 text-sm font-semibold text-[var(--fg-base)] outline-none focus:border-[var(--fg-interactive)]"
				/>
			{:else}
				<div class="flex min-w-0 items-center gap-1.5">
					<h2 class="truncate text-sm font-semibold leading-none text-[var(--fg-base)]">{app.currentProject?.name || 'Conversation'}</h2>
					{#if app.currentProject}
						<button
							onclick={startEditName}
							class="shrink-0 rounded p-1 text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-base-hover)] hover:text-[var(--fg-base)]"
							title="Ubah nama project"
							aria-label="Ubah nama project"
						>
							<PencilIcon size={13} />
						</button>
					{/if}
				</div>
			{/if}
			{#if !app.aiReady}
				<span class="rounded-full border border-[var(--tag-red-border)] bg-[var(--tag-red-bg)] px-2 py-0.5 text-[10px] text-[var(--tag-red-text)]">AI not configured</span>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			{#if app.currentProject && hasMessages && !isActive}
				<button
					onclick={toggleSelectMode}
					class="rounded-md border px-2 py-1 text-[11px] font-medium transition-colors {app.selectMode ? 'border-[var(--fg-interactive)] bg-[var(--bg-subtle)] text-[var(--fg-interactive)]' : 'border-[var(--border-base)] text-[var(--fg-muted)] hover:bg-[var(--bg-base-hover)] hover:text-[var(--fg-base)]'}"
					title="Pilih pesan untuk disalin"
				>
					Select
				</button>
			{/if}
			{#if app.currentProject && !app.selectMode}<ContextMeter />{/if}
			{#if isActive || isTerminalStatus}
				<div class="flex items-center gap-1.5 rounded-full border border-[var(--border-base)] bg-[var(--bg-subtle)] px-2.5 py-1 text-[11px] {isTerminalStatus ? 'text-[var(--fg-muted)]' : 'text-[var(--fg-interactive)]'} tabular-nums">
					<svg width="10" height="10" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
					<span>{elapsedTotal}</span>
				</div>
			{/if}
		</div>
	</div>

	{#if app.selectMode}
		<div class="flex h-11 shrink-0 items-center gap-3 border-b border-[var(--border-base)] bg-[var(--bg-subtle)] px-4 text-[12px]">
			<span class="font-medium text-[var(--fg-base)]">{selCount} dipilih</span>
			<button onclick={selectAllMessages} class="text-[var(--fg-interactive)] hover:underline">Select all</button>
			{#if selCount > 0}<button onclick={clearSelection} class="text-[var(--fg-muted)] hover:text-[var(--fg-base)] hover:underline">Clear</button>{/if}
			<div class="ml-auto flex items-center gap-2">
				<button
					onclick={copySelection}
					disabled={selCount === 0}
					class="inline-flex items-center gap-1.5 rounded-lg bg-[var(--fg-interactive)] px-3 py-1.5 text-[12px] font-medium text-[var(--fg-on-color)] transition-colors hover:bg-[var(--fg-interactive-hover)] disabled:cursor-not-allowed disabled:opacity-40"
				>
					{#if copiedSel}<CheckIcon size={13} />Copied{:else}Copy seleksi{/if}
				</button>
				<button onclick={toggleSelectMode} class="rounded-md p-1.5 text-[var(--fg-muted)] hover:bg-[var(--bg-base-hover)] hover:text-[var(--fg-base)]" title="Selesai" aria-label="Selesai memilih">
					<CloseIcon size={15} />
				</button>
			</div>
		</div>
	{/if}

	<div class="relative flex-1 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:28px_28px]">
		<div class="absolute inset-0 space-y-5 overflow-y-auto px-5 py-5" bind:this={scrollContainer} onscroll={handleScroll}>
			<EmptyStates {isActive} />

			{#each app.messages as msg (msg.id)}
				<ChatMessage {msg} {elapsedTotal} {isStalled} {stallSeconds} />
			{/each}
		</div>

		<button
			onclick={() => scrollToBottom()}
			class="absolute bottom-4 left-1/2 z-10 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-[var(--border-base)] bg-[var(--bg-component)] shadow-lg transition-all duration-300 hover:bg-[var(--bg-component-hover)] {showScrollButton ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-90 pointer-events-none'}"
			title="Scroll to bottom"
			aria-label="Scroll to bottom"
		>
			<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 3v8M3 7l4 4 4-4" stroke="var(--fg-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
		</button>
	</div>

	<Composer {isActive} />
</div>
