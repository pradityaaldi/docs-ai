<script lang="ts">
	import '../../app.css';
	import { app } from '$lib/stores/app.svelte';
	import AppShell from '$lib/components/AppShell.svelte';
	import { Card, Badge } from '$lib/components/ui';

	let { data } = $props();
	app.currentUser = data.user ?? null;

	const u = data.user;
	const sub = data.subscription;
	const initial = (u.name?.trim() || u.email || '?').charAt(0).toUpperCase();

	function fmtDate(s: string | Date | null) {
		if (!s) return '—';
		return new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
	}
</script>

<svelte:head><title>Profil — Paperio</title></svelte:head>

<AppShell>
	<div class="mx-auto max-w-3xl px-6 py-10">
		<h1 class="mb-6 text-2xl font-bold">Profil</h1>

		<Card padding="lg" class="mb-6">
			<div class="flex items-center gap-4">
				<div class="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[var(--fg-interactive)] text-2xl font-semibold text-[var(--bg-base)]">
					{initial}
				</div>
				<div class="min-w-0">
					<div class="flex items-center gap-2">
						<h2 class="truncate text-lg font-semibold">{u.name || 'Pengguna'}</h2>
						<Badge variant={u.role === 'admin' ? 'info' : 'neutral'}>{u.role === 'admin' ? 'Admin' : 'Pengguna'}</Badge>
					</div>
					<p class="truncate text-sm text-[var(--fg-muted)]">{u.email}</p>
				</div>
			</div>
		</Card>

		<Card padding="lg" class="mb-6">
			<h3 class="mb-4 text-sm font-semibold text-[var(--fg-muted)]">Informasi Akun</h3>
			<dl class="divide-y divide-[var(--border-base)]">
				<div class="flex items-center justify-between py-3">
					<dt class="text-sm text-[var(--fg-muted)]">Email</dt>
					<dd class="text-sm font-medium">{u.email}</dd>
				</div>
				<div class="flex items-center justify-between py-3">
					<dt class="text-sm text-[var(--fg-muted)]">Verifikasi Email</dt>
					<dd>
						<Badge variant={u.emailVerified ? 'success' : 'warning'}>
							{u.emailVerified ? 'Terverifikasi' : 'Belum verifikasi'}
						</Badge>
					</dd>
				</div>
				<div class="flex items-center justify-between py-3">
					<dt class="text-sm text-[var(--fg-muted)]">Peran</dt>
					<dd class="text-sm font-medium capitalize">{u.role}</dd>
				</div>
				<div class="flex items-center justify-between py-3">
					<dt class="text-sm text-[var(--fg-muted)]">Bergabung</dt>
					<dd class="text-sm font-medium">{fmtDate(u.createdAt)}</dd>
				</div>
			</dl>
		</Card>

		<Card padding="lg">
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-sm font-semibold text-[var(--fg-muted)]">Langganan</h3>
				<a href="/billing" class="text-sm text-[var(--fg-interactive)] hover:underline">Kelola</a>
			</div>
			{#if sub}
				<dl class="divide-y divide-[var(--border-base)]">
					<div class="flex items-center justify-between py-3">
						<dt class="text-sm text-[var(--fg-muted)]">Paket</dt>
						<dd class="text-sm font-medium">{sub.planName ?? '—'}</dd>
					</div>
					<div class="flex items-center justify-between py-3">
						<dt class="text-sm text-[var(--fg-muted)]">Status</dt>
						<dd><Badge variant="success">Aktif</Badge></dd>
					</div>
					<div class="flex items-center justify-between py-3">
						<dt class="text-sm text-[var(--fg-muted)]">Kuota Generate</dt>
						<dd class="text-sm font-medium">{sub.quotaUsed} / {sub.quota}</dd>
					</div>
					<div class="flex items-center justify-between py-3">
						<dt class="text-sm text-[var(--fg-muted)]">Berlaku Hingga</dt>
						<dd class="text-sm font-medium">{fmtDate(sub.expiresAt)}</dd>
					</div>
				</dl>
			{:else}
				<div class="flex items-center justify-between">
					<p class="text-sm text-[var(--fg-muted)]">Belum ada langganan aktif.</p>
					<a href="/billing" class="text-sm font-medium text-[var(--fg-interactive)] hover:underline">Berlangganan</a>
				</div>
			{/if}
		</Card>
	</div>
</AppShell>
