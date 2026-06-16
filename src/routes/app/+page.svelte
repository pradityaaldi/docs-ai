<script lang="ts">
	import '../../app.css';
	import { app } from '$lib/stores/app.svelte';
	import { createProjectNamed, deleteProject } from '$lib/actions';
	import { goto } from '$app/navigation';
	import AppShell from '$lib/components/AppShell.svelte';
	import { Button, Card, Input, Field } from '$lib/components/ui';
	import { FileTextIcon, FilesIcon, CloseIcon } from '$lib/components/ui/icons';

	let { data } = $props();

	let modalOpen = $state(false);
	let newName = $state('');
	let creating = $state(false);

	// Projects come from load(); sync into the store and reset stale workspace state.
	$effect(() => {
		app.currentUser = data.user ?? null;
		app.currentProject = null;
		app.projects = data.projects;
	});

	function openModal() {
		newName = '';
		modalOpen = true;
	}

	async function submitCreate() {
		if (creating) return;
		creating = true;
		const project = await createProjectNamed(newName);
		creating = false;
		if (project) {
			modalOpen = false;
			goto(`/app/${project.id}`);
		}
	}

	function fmtDate(s: string) {
		return new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
	}
</script>

<svelte:head><title>Project — Paperio</title></svelte:head>

<AppShell>
	<div class="mx-auto w-full max-w-5xl px-6 py-10">
		<div class="mb-6 flex items-center justify-between">
			<div>
				<h1 class="text-2xl font-bold">Project</h1>
				<p class="text-sm text-[var(--fg-muted)]">Kelola dokumen yang kamu buat.</p>
			</div>
			<Button size="md" onclick={openModal}>+ Buat Project</Button>
		</div>

		{#if app.projects.length === 0}
			<Card padding="lg" class="flex flex-col items-center gap-3 text-center">
				<FilesIcon size={32} />
				<div>
					<p class="font-medium">Belum ada project</p>
					<p class="text-sm text-[var(--fg-muted)]">Buat project pertamamu untuk mulai.</p>
				</div>
				<Button size="md" onclick={openModal}>+ Buat Project</Button>
			</Card>
		{:else}
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each app.projects as project (project.id)}
					<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
					<div
						class="group cursor-pointer rounded-xl border border-[var(--border-base)] bg-[var(--bg-component)] p-5 transition-colors hover:border-[var(--border-interactive)]"
						onclick={() => goto(`/app/${project.id}`)}
						role="button"
						tabindex="0"
						onkeydown={(e) => e.key === 'Enter' && goto(`/app/${project.id}`)}
					>
						<div class="flex items-start justify-between gap-2">
							<FileTextIcon size={20} />
							<button
								onclick={(e) => { e.stopPropagation(); deleteProject(project.id); }}
								class="rounded p-1 text-[var(--fg-muted)] opacity-0 transition-all hover:text-[var(--fg-error)] group-hover:opacity-100"
								title="Hapus project"
							>
								<CloseIcon size={14} />
							</button>
						</div>
						<h3 class="mt-3 truncate font-medium">{project.name}</h3>
						<p class="mt-1 text-xs text-[var(--fg-muted)]">
							{#if project.status}<span class="capitalize">{project.status}</span> · {/if}{fmtDate(project.updated_at)}
						</p>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</AppShell>

<!-- Create modal -->
{#if modalOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] p-4"
		onclick={() => (modalOpen = false)}
		role="presentation"
	>
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div onclick={(e) => e.stopPropagation()} role="presentation" class="w-full max-w-sm">
			<Card padding="lg">
				<h2 class="text-lg font-semibold">Buat Project Baru</h2>
				<p class="mt-1 text-sm text-[var(--fg-muted)]">Beri nama project kamu.</p>
				<form
					onsubmit={(e) => { e.preventDefault(); submitCreate(); }}
					class="mt-4 flex flex-col gap-4"
				>
					<Field label="Nama Project" forId="project-name">
						<!-- svelte-ignore a11y_autofocus -->
						<Input
							id="project-name"
							bind:value={newName}
							placeholder="Skripsi Bab 1"
							autofocus
							required
						/>
					</Field>
					<div class="flex justify-end gap-2">
						<Button type="button" variant="neutral" size="md" onclick={() => (modalOpen = false)}>Batal</Button>
						<Button type="submit" size="md" loading={creating}>Buat</Button>
					</div>
				</form>
			</Card>
		</div>
	</div>
{/if}
