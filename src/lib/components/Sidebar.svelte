<script lang="ts">
	import { app, showMobileDoc } from '$lib/stores/app.svelte';
	import { exitToProjects, createDocument, createFolder, selectDocument, deleteDocument, generateProjectDoc } from '$lib/actions';
	import TreeItem from '$lib/components/ui/TreeItem.svelte';
	import FileRow from '$lib/components/ui/FileRow.svelte';
	import TreeAction from '$lib/components/ui/TreeAction.svelte';
	import { ArrowLeftIcon, FilePlusIcon, FolderPlusIcon } from '$lib/components/ui/icons';

	// Workspace sidebar = single project's files. The project list lives on /app.
	function handleNavigateIntoFolder(folderId: string | null) {
		app.navigatingFolderId = folderId;
	}

	async function onSelectDocument(docId: string) {
		app.navigatingFolderId = null;
		await selectDocument({ id: docId });
		showMobileDoc();
	}
</script>

<aside class="flex flex-1 flex-col justify-between overflow-y-auto">
	<div class="flex flex-1 flex-col">
		<div class="sticky top-0 z-10 bg-[var(--bg-base)]">
			<div class="border-b border-[var(--border-base)]">
				<div class="flex h-14 items-center px-4">
					<button
						onclick={exitToProjects}
						class="-ml-2 inline-flex items-center gap-x-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-[var(--fg-subtle)] transition-colors hover:bg-[var(--bg-base-hover)] hover:text-[var(--fg-base)]"
						title="Kembali ke daftar project"
					>
						<ArrowLeftIcon size={16} />
						Keluar
					</button>
				</div>
			</div>
		</div>

		<div class="flex flex-1 flex-col">
			{#if app.currentProject?.template_id}
				<div class="px-3 pt-3">
					<button
						onclick={generateProjectDoc}
						disabled={app.isGenerating}
						class="flex w-full items-center justify-center gap-x-2 rounded-lg bg-[var(--fg-interactive)] px-3 py-2 text-sm font-medium text-[var(--fg-on-color)] outline-none transition-colors hover:bg-[var(--fg-interactive-hover)] disabled:opacity-50"
					>
						<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1l1.8 4.2L14 7l-4.2 1.8L8 13l-1.8-4.2L2 7l4.2-1.8L8 1z" fill="currentColor"/></svg>
						{app.isGenerating ? 'Membuat…' : (app.currentProject?.status === 'belum mulai' ? 'Generate Dokumen' : 'Regenerate')}
					</button>
				</div>
			{/if}

			<div class="mt-3 flex flex-col">
				<div class="flex h-9 items-center justify-between px-3">
					<span class="text-[13px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Files</span>
					<div class="flex items-center gap-x-1">
						<TreeAction title="New document" onclick={() => createDocument(null)}><FilePlusIcon size={18} /></TreeAction>
						<TreeAction title="New folder" onclick={() => createFolder(null)}><FolderPlusIcon size={18} /></TreeAction>
					</div>
				</div>

				<div class="flex flex-col">
					{#each app.projectTree as node (node.id)}
						<TreeItem {node} onNavigateInto={handleNavigateIntoFolder} />
					{/each}

					{#each app.rootDocuments as doc (doc.id)}
						<FileRow
							id={doc.id}
							title={doc.title}
							onSelect={onSelectDocument}
							onDelete={(id) => deleteDocument(id)}
						/>
					{/each}

					{#if app.projectTree.length === 0 && app.rootDocuments.length === 0}
						<div class="px-3 py-6 text-center">
							<p class="text-xs text-[var(--fg-muted)]">No documents yet</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</aside>
