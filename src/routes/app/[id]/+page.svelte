<script lang="ts">
	import '../../../app.css';
	import { loadAIStatus, enterProject } from '$lib/actions';
	import { app } from '$lib/stores/app.svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import ChatPanel from '$lib/components/ChatPanel.svelte';
	import DocumentPreview from '$lib/components/DocumentPreview.svelte';

	let { data } = $props();
	$effect(() => {
		app.currentUser = data.user ?? null;
	});

	let booted = false;
	$effect(() => {
		if (booted) return;
		booted = true;
		loadAIStatus();
		const id = page.params.id;
		fetch('/api/projects')
			.then((r) => r.json())
			.then((list) => {
				app.projects = list;
				const p = list.find((x: { id: string }) => x.id === id);
				if (p) enterProject(p);
				else goto('/app');
			})
			.catch(() => goto('/app'));
	});
</script>

<div class="flex h-dvh overflow-hidden bg-[var(--bg-subtle)] p-3">
	<div class="hidden h-full w-[292px] shrink-0 overflow-hidden rounded-xl border border-[var(--border-base)] bg-[var(--bg-base)] shadow-sm lg:flex">
		<Sidebar />
	</div>
	<div class="ml-3 flex min-w-0 flex-1 overflow-hidden rounded-xl border border-[var(--border-base)] bg-[var(--bg-base)] shadow-sm">
		<ChatPanel />
		<DocumentPreview />
	</div>
</div>
