<script lang="ts">
	import '../app.css';
	import { loadConnectors, loadDocuments } from '$lib/actions';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import ChatPanel from '$lib/components/ChatPanel.svelte';
	import DocumentPreview from '$lib/components/DocumentPreview.svelte';
	import SettingsModal from '$lib/components/SettingsModal.svelte';

	$effect(() => {
		loadConnectors();
		loadDocuments();
	});
</script>

<div class="relative flex h-screen flex-col items-start overflow-hidden lg:flex-row">
	<div class="hidden h-screen w-[220px] lg:flex">
		<Sidebar />
	</div>
	<main class="flex h-screen w-full flex-col overflow-auto bg-[var(--bg-base)]">
		<div class="flex h-full w-full flex-col">
			<div class="flex flex-1 min-w-0">
				<ChatPanel />
				<DocumentPreview />
			</div>
		</div>
	</main>
</div>

<SettingsModal />
