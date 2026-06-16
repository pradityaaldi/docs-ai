<script lang="ts">
	import { app, type TreeNode, type DocEntry } from '$lib/stores/app.svelte';
	import { createProject, deleteProject, enterProject, exitToProjects, createDocument, createFolder, selectDocument, deleteDocument, openRootChat, logout, generateProjectDoc } from '$lib/actions';
	import Breadcrumb from '$lib/components/ui/Breadcrumb.svelte';
	import TreeItem from '$lib/components/ui/TreeItem.svelte';

	let breadcrumbPath = $derived.by(() => {
		const path: { id: string; name: string; type: 'project' | 'folder' }[] = [];
		if (!app.currentProject) return path;
		path.push({ id: app.currentProject.id, name: app.currentProject.name, type: 'project' });
		return path;
	});

	function handleNavigateIntoFolder(folderId: string | null) {
		app.navigatingFolderId = folderId;
	}

	async function onSelectDocument(docId: string) {
		app.navigatingFolderId = null;
		await selectDocument({ id: docId });
	}
</script>

<aside class="flex flex-1 flex-col justify-between overflow-y-auto border-e border-[var(--border-base)]">
	<div class="flex flex-1 flex-col">
		<div class="bg-[var(--bg-subtle)] sticky top-0 z-10">
			{#if app.sidebarView === 'projects'}
				<div class="h-[45px] px-4 flex items-center gap-x-2.5 border-b border-[var(--border-base)]">
					<div class="w-6 h-6 rounded-md bg-[var(--fg-interactive)] flex items-center justify-center">
						<svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 4h3l1-2h4l1 2h3v9H2V4z" fill="white" opacity="0.9"/></svg>
					</div>
					<span class="text-sm font-medium text-[var(--fg-base)]">Docs AI</span>
				</div>
			{:else}
				<div class="border-b border-[var(--border-base)]">
					<div class="h-[45px] px-4 flex items-center gap-x-2">
						<button
							onclick={exitToProjects}
							class="p-1 -ml-1 rounded-md hover:bg-[var(--bg-base-hover)] cursor-pointer transition-fg text-[var(--fg-subtle)] hover:text-[var(--fg-base)]"
							title="Back to projects"
						>
							<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 4l-4 4 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
						</button>
						<span class="text-sm font-medium text-[var(--fg-base)] truncate">{app.currentProject?.name || ''}</span>
					</div>
					<Breadcrumb path={breadcrumbPath} onNavigate={(i) => {
						if (i === -1) exitToProjects();
					}} />
				</div>
			{/if}
		</div>

		<div class="flex flex-1 flex-col justify-between">
			<div class="flex flex-1 flex-col">
				{#if app.sidebarView === 'projects'}
					<!-- Projects View -->
					<div class="px-3 pt-3 flex flex-col gap-y-1">
						<a
							href="/templates"
							class="w-full flex items-center gap-x-2 px-3 py-1.5 rounded-md text-sm font-medium bg-[var(--fg-interactive)] text-[var(--fg-on-color)] hover:opacity-90 transition-fg cursor-pointer outline-none"
						>
							<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 3h5v5H2V3zM9 3h5v5H9V3zM2 9h5v4H2V9zM9 9h5v4H9V9z" stroke="currentColor" stroke-width="1.3"/></svg>
							Galeri Template
						</a>
						<button
							onclick={createProject}
							class="w-full flex items-center gap-x-2 px-3 py-1.5 rounded-md text-sm text-[var(--fg-subtle)] transition-fg hover:bg-[var(--bg-base-hover)] cursor-pointer outline-none"
						>
							<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
							Project Kosong
						</button>
					</div>

					<div class="px-3 py-2">
						<p class="px-3 py-1.5 text-xs font-medium text-[var(--fg-muted)]">Projects</p>
						<div class="flex flex-col gap-y-0.5">
							{#each app.projects as project (project.id)}
								<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
								<div
									class="group text-[var(--fg-subtle)] transition-fg hover:bg-[var(--bg-base-hover)] flex items-center gap-x-2 rounded-md py-1 pl-2 pr-1.5 outline-none cursor-pointer text-sm {app.currentProject?.id === project.id ? 'bg-[var(--bg-base)] text-[var(--fg-base)] hover:bg-[var(--bg-base)] shadow-[0_1px_2px_rgba(0,0,0,0.2)]' : ''}"
									onclick={() => enterProject(project)}
									role="button"
									tabindex="0"
									onkeydown={(e) => e.key === 'Enter' && enterProject(project)}
								>
									<svg width="14" height="14" viewBox="0 0 16 16" fill="none" class="shrink-0">
										<path d="M2 4h4.5l1.5 1.5H14v7H2V4z" fill="currentColor" opacity="0.3"/>
										<path d="M2 4h4.5l1.5 1.5H14v7H2V4z" stroke="currentColor" stroke-width="1.2"/>
									</svg>
									<div class="flex-1 min-w-0 flex flex-col">
										<span class="truncate">{project.name}</span>
										<span class="text-xs text-[var(--fg-muted)]">
											{#if project.status}<span class="capitalize">{project.status}</span> · {/if}{new Date(project.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
										</span>
									</div>
									<button
										onclick={(e) => { e.stopPropagation(); deleteProject(project.id); }}
										class="opacity-0 group-hover:opacity-100 p-1 text-[var(--fg-muted)] hover:text-[var(--fg-error)] transition-all cursor-pointer rounded"
									>
										<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M5 4V3h4v1M4 4v7a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
									</button>
								</div>
							{/each}
							{#if app.projects.length === 0}
								<div class="text-center py-6 px-2">
									<p class="text-xs text-[var(--fg-muted)]">No projects yet</p>
								</div>
							{/if}
						</div>
					</div>
				{:else}
					<!-- Project Detail View -->
					<div class="px-3 pt-2 flex flex-col gap-y-1">
						{#if app.currentProject?.template_id}
							<button
								onclick={generateProjectDoc}
								disabled={app.isGenerating}
								class="w-full flex items-center gap-x-2 px-3 py-1.5 rounded-md text-sm font-medium bg-[var(--fg-interactive)] text-[var(--fg-on-color)] hover:opacity-90 disabled:opacity-50 transition-fg cursor-pointer outline-none"
							>
								<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1l1.8 4.2L14 7l-4.2 1.8L8 13l-1.8-4.2L2 7l4.2-1.8L8 1z" fill="currentColor"/></svg>
								{app.isGenerating ? 'Membuat…' : (app.currentProject?.status === 'belum mulai' ? 'Generate Dokumen' : 'Regenerate')}
							</button>
						{/if}
						<button
							onclick={() => createDocument(null)}
							class="w-full flex items-center gap-x-2 px-3 py-1.5 rounded-md text-sm text-[var(--fg-subtle)] transition-fg hover:bg-[var(--bg-base-hover)] cursor-pointer outline-none"
						>
							<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 2h8l2 2v10H2V4l2-2z" stroke="currentColor" stroke-width="1.2"/><path d="M8 6v4M6 8h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
							New Document
						</button>
						<button
							onclick={() => createFolder(null)}
							class="w-full flex items-center gap-x-2 px-3 py-1.5 rounded-md text-sm text-[var(--fg-subtle)] transition-fg hover:bg-[var(--bg-base-hover)] cursor-pointer outline-none"
						>
							<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 4h4.5l1.5 1.5H14v7H2V4z" fill="currentColor" opacity="0.3"/><path d="M2 4h4.5l1.5 1.5H14v7H2V4z" stroke="currentColor" stroke-width="1.2"/><path d="M9 7v4M7 9h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
							New Folder
						</button>
						<button
							onclick={openRootChat}
							class="w-full flex items-center gap-x-2 px-3 py-1.5 rounded-md text-sm transition-fg cursor-pointer outline-none {app.currentDoc?.id === app.globalConversation?.id ? 'bg-[var(--bg-base)] text-[var(--fg-base)] shadow-[0_1px_2px_rgba(0,0,0,0.2)]' : 'text-[var(--fg-subtle)] hover:bg-[var(--bg-base-hover)]'}"
						>
							<svg width="14" height="14" viewBox="0 0 16 16" fill="none" class="shrink-0"><path d="M2 3h12v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3z" stroke="currentColor" stroke-width="1.2"/><path d="M5 7h6M5 10h4" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>
							Root Chat
						</button>
					</div>

					<div class="px-3 py-2">
						<p class="px-3 py-1.5 text-xs font-medium text-[var(--fg-muted)]">Files</p>
						<div class="flex flex-col gap-y-0.5">
							{#each app.rootDocuments as doc (doc.id)}
								<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
								<div
									class="group flex items-center gap-x-1.5 py-1 pl-2 pr-1 rounded-md cursor-pointer text-sm transition-fg {app.currentDoc?.id === doc.id ? 'bg-[var(--bg-base)] text-[var(--fg-base)] shadow-[0_1px_2px_rgba(0,0,0,0.2)]' : 'text-[var(--fg-subtle)] hover:bg-[var(--bg-base-hover)]'}"
									onclick={() => onSelectDocument(doc.id)}
									role="button"
									tabindex="0"
									onkeydown={(e) => e.key === 'Enter' && onSelectDocument(doc.id)}
								>
									<svg width="12" height="12" viewBox="0 0 16 16" fill="none" class="shrink-0"><path d="M4 2h8l2 2v10H2V4l2-2z" stroke="currentColor" stroke-width="1.2"/><path d="M6 7h6M6 10h4" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>
									<span class="flex-1 min-w-0 truncate">{doc.title}</span>
									<button
										onclick={(e) => { e.stopPropagation(); deleteDocument(doc.id); }}
										class="hidden group-hover:block p-1 text-[var(--fg-muted)] hover:text-[var(--fg-error)] cursor-pointer rounded"
									>
										<svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M5 4V3h4v1M4 4v7a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
									</button>
								</div>
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
				{/if}
			</div>

		</div>
	</div>

	<div class="sticky bottom-0 px-3 pb-3 space-y-2">
		{#if app.currentUser}
			<div class="flex items-center justify-between gap-x-2 bg-[var(--bg-component)] border border-[var(--border-base)] rounded-lg px-3 py-2">
				<div class="min-w-0">
					<div class="text-xs font-medium text-[var(--fg-base)] truncate">{app.currentUser.name || app.currentUser.email}</div>
					<div class="text-[10px] text-[var(--fg-muted)] truncate">{app.currentUser.email}{app.currentUser.role === 'admin' ? ' · admin' : ''}</div>
				</div>
				<button onclick={logout} title="Logout"
					class="shrink-0 text-xs text-[var(--fg-muted)] hover:text-[var(--fg-error)] px-2 py-1 rounded-md hover:bg-[var(--bg-base-hover)]">
					Keluar
				</button>
			</div>
		{/if}
		<div class="bg-[var(--bg-component)] border border-[var(--border-base)] rounded-lg p-3 flex items-center justify-between">
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
