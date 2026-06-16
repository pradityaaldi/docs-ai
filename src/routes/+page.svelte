<script lang="ts">
	import '../app.css';
	import { loadAIStatus, loadProjects, enterProject } from '$lib/actions';
	import { app } from '$lib/stores/app.svelte';
	import { page } from '$app/state';
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
		const wantProject = page.url.searchParams.get('project');
		loadProjects().then(() => {
			if (wantProject) {
				const p = app.projects.find((x) => x.id === wantProject);
				if (p) enterProject(p);
			}
		});
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
