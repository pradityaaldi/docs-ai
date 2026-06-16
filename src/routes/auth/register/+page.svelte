<script lang="ts">
	import AuthShell from '$lib/components/auth/AuthShell.svelte';
	import Divider from '$lib/components/auth/Divider.svelte';
	import GoogleButton from '$lib/components/auth/GoogleButton.svelte';
	import { Alert, Button, Input } from '$lib/components/ui';

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);
	let done = $state(false);

	async function submit(e: Event) {
		e.preventDefault();
		error = '';
		loading = true;
		try {
			const res = await fetch('/api/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, email, password })
			});
			const data = await res.json();
			if (!res.ok) {
				error = data.error || 'Pendaftaran gagal';
				return;
			}
			done = true;
		} finally {
			loading = false;
		}
	}
</script>

<AuthShell>
	{#if done}
		<div class="text-center">
			<div class="text-4xl mb-3">📧</div>
			<h1 class="text-lg font-semibold mb-1">Cek email kamu</h1>
			<p class="text-sm text-[var(--fg-muted)]">Kami kirim link verifikasi ke <b>{email}</b>. Klik link itu untuk aktifkan akun.</p>
			<a href="/auth/login" class="inline-block mt-4 text-sm text-[var(--fg-interactive)] underline">Ke login</a>
		</div>
	{:else}
		<h1 class="text-xl font-semibold mb-1">Daftar Paperio</h1>
		<p class="text-sm text-[var(--fg-muted)] mb-6">Gratis, mulai bikin dokumen</p>

		{#if error}<Alert class="mb-4">{error}</Alert>{/if}

		<form onsubmit={submit} class="space-y-3">
			<Input bind:value={name} type="text" placeholder="Nama" />
			<Input bind:value={email} type="email" placeholder="Email" required />
			<Input bind:value={password} type="password" placeholder="Password (min 8 karakter)" required />
			<Button type="submit" full {loading}>
				{loading ? 'Memproses…' : 'Daftar'}
			</Button>
		</form>

		<Divider />
		<GoogleButton icon={false} />

		<p class="text-center mt-5 text-sm text-[var(--fg-muted)]">
			Sudah punya akun? <a href="/auth/login" class="text-[var(--fg-interactive)] hover:underline">Masuk</a>
		</p>
	{/if}
</AuthShell>
