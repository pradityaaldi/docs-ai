<script lang="ts">
	import '../../app.css';
	import { PageHeader, Tabs } from '$lib/components/ui';
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
	const catEmoji: Record<string, string> = { skripsi: '🎓', makalah: '📄', surat: '✉️' };
</script>

<div class="min-h-dvh bg-[var(--bg-base)]">
	<PageHeader title="Galeri Template" subtitle="Pilih template siap pakai, isi form, AI bikin dokumennya.">
		{#snippet actions()}
			<a href="/" class="text-sm text-[var(--fg-interactive)] hover:underline">← Dashboard</a>
		{/snippet}
	</PageHeader>

	<div class="px-6 py-4">
		<Tabs tabs={CATS} bind:active={activeCat} class="mb-5" />

		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each filtered as t (t.id)}
				<a
					href="/templates/{t.slug}"
					class="group bg-[var(--bg-component)] border border-[var(--border-base)] rounded-xl overflow-hidden hover:border-[var(--border-interactive)] transition-colors"
				>
					<div class="h-28 flex items-center justify-center text-5xl bg-[var(--bg-base-hover)] border-b border-[var(--border-base)]">
						{catEmoji[t.category] ?? '📑'}
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
