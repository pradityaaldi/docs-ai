<script lang="ts">
	import { app } from '$lib/stores/app.svelte';
	import { exitToProjects, createDocument, createFolder, selectDocument, deleteDocument, logout, generateProjectDoc } from '$lib/actions';
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
				<div class="group/files flex items-center justify-between px-3 py-1">
					<span class="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Files</span>
					<div class="flex items-center gap-x-0.5 opacity-0 transition-opacity group-hover/files:opacity-100">
						<TreeAction title="New document" onclick={() => createDocument(null)}><FilePlusIcon size={14} /></TreeAction>
						<TreeAction title="New folder" onclick={() => createFolder(null)}><FolderPlusIcon size={14} /></TreeAction>
					</div>
				</div>

				<div class="flex flex-col">
					{#each app.rootDocuments as doc (doc.id)}
						<FileRow
							id={doc.id}
							title={doc.title}
							onSelect={onSelectDocument}
							onDelete={(id) => deleteDocument(id)}
						/>
					{/each}

					{#each app.projectTree as node (node.id)}
						<TreeItem {node} onNavigateInto={handleNavigateIntoFolder} />
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

	<div class="sticky bottom-0 space-y-2 bg-[var(--bg-base)] px-3 pb-3 pt-2">
		{#if app.currentUser}
			<div class="flex items-center justify-between gap-x-2 rounded-xl border border-[var(--border-base)] bg-[var(--bg-component)] px-3 py-2 shadow-sm">
				<div class="min-w-0">
					<div class="text-xs font-medium text-[var(--fg-base)] truncate">{app.currentUser.name || app.currentUser.email}</div>
					<div class="text-[10px] text-[var(--fg-muted)] truncate">{app.currentUser.email}{app.currentUser.role === 'admin' ? ' · admin' : ''}</div>
				</div>
				<button onclick={logout} title="Logout"
					class="shrink-0 rounded-md px-2 py-1 text-xs text-[var(--fg-muted)] hover:bg-[var(--bg-base-hover)] hover:text-[var(--fg-error)]">
					Keluar
				</button>
			</div>
		{/if}
		<div class="flex items-center justify-between rounded-xl border border-[var(--border-base)] bg-[var(--bg-component)] p-3 shadow-sm">
			{#if app.aiReady}
				<div class="flex items-center gap-x-2 min-w-0">
					<span class="w-1.5 h-1.5 rounded-full bg-[var(--tag-green-text)] shrink-0"></span>
					<span class="text-xs text-[var(--fg-subtle)] truncate">AI: {app.aiProvider}</span>
				</div>
			{:else}
				<div class="flex items-center gap-x-2">
					<span class="w-1.5 h-1.5 rounded-full bg-[var(--fg-error)] shrink-0"></span>
					<span class="text-xs text-[var(--fg-subtle)]">AI not configured</span>
				</div>
			{/if}
			{#if app.currentUser?.role === 'admin'}
				<a href="/admin" class="text-xs text-[var(--fg-interactive)] hover:underline shrink-0">Admin</a>
			{/if}
		</div>
	</div>
</aside>
