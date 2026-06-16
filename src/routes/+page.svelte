<script lang="ts">
	import '../app.css';
	import { Button } from '$lib/components/ui';
	import { GraduationCapIcon, FileTextIcon, CheckCircleIcon } from '$lib/components/ui/icons';

	let { data } = $props();
	const user = $derived(data?.user ?? null);
</script>

<svelte:head>
	<title>Paperio — Generator Dokumen AI</title>
	<meta
		name="description"
		content="Pilih template, isi form, AI bikin dokumen lengkap sekali jalan. Skripsi, makalah, surat resmi, dan lainnya."
	/>
</svelte:head>

<main class="min-h-dvh bg-[var(--bg-base)] text-[var(--fg-base)]">
	<header class="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
		<div class="flex items-center gap-2 font-semibold">
			<FileTextIcon size={20} />
			<span>Paperio</span>
		</div>
		<nav class="flex items-center gap-2">
			{#if user}
				<Button href="/app" size="sm">Buka App</Button>
			{:else}
				<Button href="/auth/login" variant="ghost" size="sm">Masuk</Button>
				<Button href="/auth/register" size="sm">Daftar</Button>
			{/if}
		</nav>
	</header>

	<section class="mx-auto flex max-w-3xl flex-col items-center px-6 py-20 text-center sm:py-28">
		<span
			class="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--tag-blue-border)] bg-[var(--tag-blue-bg)] px-3 py-1 text-xs font-medium text-[var(--tag-blue-text)]"
		>
			<GraduationCapIcon size={14} />
			Dibuat untuk pelajar & profesional Indonesia
		</span>

		<h1 class="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
			Dokumen lengkap, sekali jalan dengan AI
		</h1>

		<p class="mt-5 max-w-xl text-lg text-[var(--fg-muted)]">
			Pilih template — Skripsi, Makalah, Surat Resmi — isi form singkat, AI menyusun
			seluruh dokumen siap ekspor ke DOCX atau PDF.
		</p>

		<div class="mt-8 flex flex-col gap-3 sm:flex-row">
			{#if user}
				<Button href="/app" size="md">Buka App</Button>
				<Button href="/templates" variant="neutral" size="md">Lihat Template</Button>
			{:else}
				<Button href="/auth/register" size="md">Mulai Gratis</Button>
				<Button href="/auth/login" variant="neutral" size="md">Masuk</Button>
			{/if}
		</div>

		<ul class="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-[var(--fg-muted)]">
			{#each ['Template siap pakai', 'Sekali generate', 'Ekspor DOCX & PDF'] as item}
				<li class="inline-flex items-center gap-1.5">
					<CheckCircleIcon size={16} />
					{item}
				</li>
			{/each}
		</ul>
	</section>
</main>
