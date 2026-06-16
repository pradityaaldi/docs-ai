<script lang="ts">
	import '../../app.css';
	import { PageHeader, Tabs, ArrowLeftIcon, GraduationCapIcon, FileTextIcon, MailIcon, FilesIcon } from '$lib/components/ui';
	import type { Component } from 'svelte';
	let { data } = $props();

	const CATS = [
		{ key: 'all', label: 'Semua' },
		{ key: 'skripsi', label: 'Skripsi' },
		{ key: 'makalah', label: 'Makalah / Tugas' },
		{ key: 'surat', label: 'Surat' }
	];
	let activeCat = $state('all');

	let filtered = $derived(
		activeCat === 'all' ? data.templates : data.templates.filter((t) => t.category === activeCat)
	);

	const catBadge: Record<string, string> = {
		skripsi: 'Skripsi',
		makalah: 'Makalah',
		surat: 'Surat'
	};
	const catIcon: Record<string, Component> = { skripsi: GraduationCapIcon, makalah: FileTextIcon, surat: MailIcon };
</script>

<div class="min-h-dvh bg-[var(--bg-base)]">
	<PageHeader title="Galeri Template" subtitle="Pilih template siap pakai, isi form, AI bikin dokumennya.">
		{#snippet actions()}
			<a href="/" class="inline-flex items-center gap-1 text-sm text-[var(--fg-interactive)] hover:underline"><ArrowLeftIcon size={14} />Dashboard</a>
		{/snippet}
	</PageHeader>

	<div class="px-6 py-4">
		<Tabs tabs={CATS} bind:active={activeCat} class="mb-5" />

		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each filtered as t (t.id)}
				{@const Icon = catIcon[t.category] ?? FilesIcon}
				<a
					href="/templates/{t.slug}"
					class="group bg-[var(--bg-component)] border border-[var(--border-base)] rounded-xl overflow-hidden hover:border-[var(--border-interactive)] transition-colors"
				>
					<div class="h-28 flex items-center justify-center bg-[var(--bg-base-hover)] border-b border-[var(--border-base)] text-[var(--fg-muted)] group-hover:text-[var(--fg-interactive)] transition-colors">
						<Icon size={44} />
					</div>
					<div class="p-4">
						<div class="flex items-center gap-2 mb-1">
							<span class="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--bg-base-hover)] text-[var(--fg-muted)]">{catBadge[t.category] ?? t.category}</span>
							{#if t.kampus}<span class="text-[10px] text-[var(--fg-muted)] truncate">{t.kampus}</span>{/if}
						</div>
						<h3 class="font-medium text-[var(--fg-base)] group-hover:text-[var(--fg-interactive)]">{t.name}</h3>
						<p class="text-xs text-[var(--fg-muted)] mt-1 line-clamp-2">{t.description}</p>
					</div>
				</a>
			{/each}
		</div>

		{#if filtered.length === 0}
			<p class="text-sm text-[var(--fg-muted)] text-center py-12">Belum ada template di kategori ini.</p>
		{/if}
	</div>
</div>
