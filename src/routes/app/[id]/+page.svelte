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
	app.currentUser = data.user ?? null;

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

<div class="h-dvh flex overflow-hidden">
	<div class="hidden h-full w-[260px] lg:flex">
		<Sidebar />
	</div>
	<div class="flex-1 flex min-w-0">
		<ChatPanel />
		<DocumentPreview />
	</div>
</div>
