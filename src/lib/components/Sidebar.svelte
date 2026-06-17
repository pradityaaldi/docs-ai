<script lang="ts">
	import { app } from '$lib/stores/app.svelte';
	import { exitToProjects, createDocument, createFolder, selectDocument, deleteDocument, logout, generateProjectDoc } from '$lib/actions';
	import TreeItem from '$lib/components/ui/TreeItem.svelte';
	import FileRow from '$lib/components/ui/FileRow.svelte';
	import { ArrowLeftIcon } from '$lib/components/ui/icons';

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

		<div class="flex flex-1 flex-col justify-between">
			<div class="flex flex-1 flex-col">
				<div class="flex flex-col gap-y-1 px-3 pt-3">
					{#if app.currentProject?.template_id}
						<button
							onclick={generateProjectDoc}
							disabled={app.isGenerating}
							class="flex w-full items-center gap-x-2 rounded-lg bg-[var(--fg-interactive)] px-3 py-2 text-sm font-medium text-[var(--fg-on-color)] outline-none transition-colors hover:bg-[var(--fg-interactive-hover)] disabled:opacity-50"
						>
							<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1l1.8 4.2L14 7l-4.2 1.8L8 13l-1.8-4.2L2 7l4.2-1.8L8 1z" fill="currentColor"/></svg>
							{app.isGenerating ? 'Membuat…' : (app.currentProject?.status === 'belum mulai' ? 'Generate Dokumen' : 'Regenerate')}
						</button>
					{/if}
					<button
						onclick={() => createDocument(null)}
						class="flex w-full items-center gap-x-2 rounded-lg px-3 py-2 text-sm text-[var(--fg-subtle)] outline-none transition-colors hover:bg-[var(--bg-base-hover)]"
					>
						<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 2h8l2 2v10H2V4l2-2z" stroke="currentColor" stroke-width="1.2"/><path d="M8 6v4M6 8h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
						New Document
					</button>
					<button
						onclick={() => createFolder(null)}
						class="flex w-full items-center gap-x-2 rounded-lg px-3 py-2 text-sm text-[var(--fg-subtle)] outline-none transition-colors hover:bg-[var(--bg-base-hover)]"
					>
						<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 4h4.5l1.5 1.5H14v7H2V4z" fill="currentColor" opacity="0.3"/><path d="M2 4h4.5l1.5 1.5H14v7H2V4z" stroke="currentColor" stroke-width="1.2"/><path d="M9 7v4M7 9h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
						New Folder
					</button>
				</div>

				<div class="px-3 py-2">
					<p class="px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">Files</p>
					<div class="flex flex-col gap-y-0.5">
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
							<div class="text-center py-6 px-2">
								<p class="text-xs text-[var(--fg-muted)]">No documents yet</p>
							</div>
						{/if}
					</div>
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
