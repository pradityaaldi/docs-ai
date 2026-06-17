<script lang="ts">
	import '../../../app.css';
	import { loadAIStatus, loadProjectMessages } from '$lib/actions';
	import { app } from '$lib/stores/app.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import ChatPanel from '$lib/components/ChatPanel.svelte';
	import DocumentPreview from '$lib/components/DocumentPreview.svelte';

	let { data } = $props();

	// Sync the server-loaded project into the shared workspace store. `$effect.pre`
	// runs before paint, so the panes render populated on the first frame — no stale
	// frame, no project-list flash. Reruns when `data` changes (switching projects).
	$effect.pre(() => {
		app.currentUser = data.user ?? null;
		app.currentProject = data.project;
		app.projectTree = data.tree;
		app.rootDocuments = data.rootDocuments;
		app.sidebarView = 'project-detail';
		app.currentDoc = null;
		app.messages = [];
		app.mentions = [];
		app.expandedFolderIds = new Set();
		app.navigatingFolderId = null;
		loadProjectMessages(data.project.id);
	});

	// App-global, non-structural: AI provider status badge. Runs once on mount.
	$effect(() => {
		loadAIStatus();
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
