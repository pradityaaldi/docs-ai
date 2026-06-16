<script lang="ts">
	import '../../app.css';
	import { goto } from '$app/navigation';
	import { Alert, Button, Card, PageHeader } from '$lib/components/ui';
	let { data } = $props();

	let loadingId = $state('');
	let error = $state('');
	let info = $state('');

	function rupiah(n: number) {
		return 'Rp ' + n.toLocaleString('id-ID');
	}

	function loadSnap(snapUrl: string, clientKey: string): Promise<void> {
		return new Promise((resolve) => {
			if ((window as any).snap) return resolve();
			const s = document.createElement('script');
			s.src = snapUrl;
			s.setAttribute('data-client-key', clientKey);
			s.onload = () => resolve();
			document.head.appendChild(s);
		});
	}

	async function checkout(planId: string) {
		error = '';
		info = '';
		loadingId = planId;
		try {
			const res = await fetch('/api/billing/checkout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ planId })
			});
			const d = await res.json();
			if (!res.ok) {
				error = d.error || 'Checkout gagal';
				return;
			}
			if (d.configured === false) {
				info = d.message || 'Midtrans belum dikonfigurasi. Hubungi admin untuk aktivasi.';
				return;
			}
			await loadSnap(d.snap_url, d.client_key);
			(window as any).snap.pay(d.token, {
				onSuccess: () => goto('/'),
				onPending: () => (info = 'Pembayaran pending. Akses aktif setelah pembayaran dikonfirmasi.'),
				onError: () => (error = 'Pembayaran gagal.'),
				onClose: () => (info = 'Popup pembayaran ditutup.')
			});
		} catch (e: any) {
			error = e?.message || 'Checkout gagal';
		} finally {
			loadingId = '';
		}
	}
</script>

<div class="min-h-dvh bg-[var(--bg-base)]">
	<PageHeader title="Pilih Paket" subtitle="Berlangganan untuk mulai generate dokumen.">
		{#snippet actions()}
			{#if data.active}<a href="/" class="text-sm text-[var(--fg-interactive)] hover:underline">← Dashboard</a>{/if}
		{/snippet}
	</PageHeader>

	<div class="px-6 py-6 max-w-4xl mx-auto">
		{#if data.active}
			<Card rounded="lg" padding="none" class="mb-6 px-4 py-3 text-sm">
				✅ Langganan aktif: <b>{data.active.planName}</b>
				{#if data.active.expiresAt}· berlaku s/d {new Date(data.active.expiresAt).toLocaleDateString('id-ID')}{/if}
				· terpakai {data.active.quotaUsed}×
			</Card>
		{:else}
			<Alert class="mb-6">Kamu belum punya langganan aktif. Pilih paket di bawah untuk mulai.</Alert>
		{/if}

		{#if error}<div class="mb-4 text-sm text-[var(--fg-error)]">{error}</div>{/if}
		{#if info}<Alert variant="info" class="mb-4">{info}</Alert>{/if}

		<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
			{#each data.plans as p (p.id)}
				<Card class="flex flex-col">
					<h3 class="font-semibold text-lg">{p.name}</h3>
					<div class="text-2xl font-bold mt-2">{p.price === 0 ? 'Gratis' : rupiah(p.price)}</div>
					<div class="text-xs text-[var(--fg-muted)] mb-4">/ {p.durationDays} hari</div>
					<ul class="text-sm text-[var(--fg-subtle)] space-y-1 flex-1">
						<li>✓ {p.quota} generate dokumen</li>
						<li>✓ {p.maxProjects} project</li>
						<li>✓ Export DOCX</li>
					</ul>
					<Button full class="mt-4" onclick={() => checkout(p.id)} loading={loadingId === p.id}>
						{loadingId === p.id ? 'Memproses…' : p.price === 0 ? 'Pilih' : 'Bayar'}
					</Button>
				</Card>
			{/each}
		</div>

		{#if !data.paymentReady}
			<p class="text-xs text-[var(--fg-muted)] mt-6 text-center">
				Mode demo: gateway pembayaran belum dikonfigurasi. Admin dapat mengaktifkan langganan secara manual.
			</p>
		{/if}

		<div class="mt-8 text-center">
			<form method="POST" action="/api/auth/logout" onsubmit={(e) => { e.preventDefault(); fetch('/api/auth/logout', { method: 'POST' }).then(() => goto('/auth/login')); }}>
				<button class="text-sm text-[var(--fg-muted)] hover:underline">Keluar</button>
			</form>
		</div>
	</div>
</div>
