<script lang="ts">
	import type { Snippet } from 'svelte';
	import { app } from '$lib/stores/app.svelte';
	import UserMenu from '$lib/components/UserMenu.svelte';
	import { FileTextIcon } from '$lib/components/ui/icons';

	let { children }: { children: Snippet } = $props();
</script>

<div class="min-h-dvh flex flex-col bg-[var(--bg-base)] text-[var(--fg-base)]">
	<!-- Navbar -->
	<header class="border-b border-[var(--border-base)] bg-[var(--bg-subtle)]">
		<div class="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
			<a href="/app" class="flex items-center gap-2 font-semibold">
				<FileTextIcon size={20} />
				<span>Paperio</span>
			</a>
			<nav class="flex items-center gap-3">
				<a href="/app" class="text-sm text-[var(--fg-interactive)] hover:underline">Project</a>
				<a href="/templates" class="text-sm text-[var(--fg-interactive)] hover:underline">Galeri Template</a>
				{#if app.currentUser?.role === 'admin'}
					<a href="/admin" class="text-sm text-[var(--fg-interactive)] hover:underline">Admin</a>
				{/if}
				<UserMenu />
			</nav>
		</div>
	</header>

	<!-- Content -->
	<main class="w-full flex-1">
		{@render children()}
	</main>

	<!-- Footer -->
	<footer class="border-t border-[var(--border-base)] bg-[var(--bg-subtle)]">
		<div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-5 text-xs text-[var(--fg-muted)]">
			<span>Paperio — Generator Dokumen AI</span>
			<a href="/" class="hover:underline">Beranda</a>
		</div>
	</footer>
</div>
