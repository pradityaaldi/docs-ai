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

<div class="h-dvh flex overflow-hidden">
	<div class="hidden h-full w-[220px] lg:flex">
		<Sidebar />
	</div>
	<div class="flex-1 flex min-w-0">
		<ChatPanel />
		<DocumentPreview />
	</div>
</div>

<SettingsModal />
