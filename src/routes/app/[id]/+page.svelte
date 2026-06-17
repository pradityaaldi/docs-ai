<script lang="ts">
	import '../../../app.css';
	import { loadAIStatus, loadProjectMessages } from '$lib/actions';
	import { app } from '$lib/stores/app.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import ChatPanel from '$lib/components/ChatPanel.svelte';
	import DocumentPreview from '$lib/components/DocumentPreview.svelte';
	import { FilesIcon, ChatIcon, FileTextIcon } from '$lib/components/ui/icons';

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
		app.mobileView = 'chat';
		app.mobileSidebarOpen = false;
		loadProjectMessages(data.project.id);
	});

	// App-global, non-structural: AI provider status badge. Runs once on mount.
	$effect(() => {
		loadAIStatus();
	});
</script>

<div class="flex h-dvh flex-col overflow-hidden bg-[var(--bg-subtle)] lg:p-3">
	<!-- Mobile top bar: files drawer toggle + Chat/Document pane switcher (<lg only). -->
	<div class="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--border-base)] bg-[var(--bg-base)] px-3 lg:hidden">
		<button
			onclick={() => (app.mobileSidebarOpen = true)}
			class="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-base)] bg-[var(--bg-subtle)] px-2.5 py-1.5 text-sm font-medium text-[var(--fg-base)] transition-colors hover:bg-[var(--bg-base-hover)]"
		>
			<FilesIcon size={16} />
			Files
		</button>

		<div class="ml-auto flex rounded-lg border border-[var(--border-base)] bg-[var(--bg-subtle)] p-0.5">
			<button
				onclick={() => (app.mobileView = 'chat')}
				class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors {app.mobileView === 'chat' ? 'bg-[var(--bg-component)] text-[var(--fg-base)] shadow-sm ring-1 ring-[var(--border-base)]' : 'text-[var(--fg-subtle)]'}"
			>
				<ChatIcon size={15} />
				Chat
			</button>
			<button
				onclick={() => (app.mobileView = 'document')}
				class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors {app.mobileView === 'document' ? 'bg-[var(--bg-component)] text-[var(--fg-base)] shadow-sm ring-1 ring-[var(--border-base)]' : 'text-[var(--fg-subtle)]'}"
			>
				<FileTextIcon size={15} />
				Dokumen
			</button>
		</div>
	</div>

	<div class="flex min-h-0 flex-1 overflow-hidden lg:gap-3">
		<!-- Desktop sidebar (files). Mobile uses the drawer below. -->
		<div class="hidden h-full w-[292px] shrink-0 overflow-hidden rounded-xl border border-[var(--border-base)] bg-[var(--bg-base)] shadow-sm lg:flex">
			<Sidebar />
		</div>
		<div class="flex min-w-0 flex-1 overflow-hidden bg-[var(--bg-base)] lg:rounded-xl lg:border lg:border-[var(--border-base)] lg:shadow-sm">
			<ChatPanel />
			<DocumentPreview />
		</div>
	</div>
</div>

<!-- Mobile files drawer: slide-in panel + backdrop (<lg only). -->
{#if app.mobileSidebarOpen}
	<div class="fixed inset-0 z-50 lg:hidden">
		<button
			class="absolute inset-0 bg-black/50"
			onclick={() => (app.mobileSidebarOpen = false)}
			aria-label="Tutup daftar file"
		></button>
		<div class="absolute inset-y-0 left-0 flex w-[84%] max-w-[320px] flex-col bg-[var(--bg-base)] shadow-2xl">
			<Sidebar />
		</div>
	</div>
{/if}
