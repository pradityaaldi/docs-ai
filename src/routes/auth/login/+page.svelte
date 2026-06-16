<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import AuthShell from '$lib/components/auth/AuthShell.svelte';
	import Divider from '$lib/components/auth/Divider.svelte';
	import GoogleButton from '$lib/components/auth/GoogleButton.svelte';
	import { Alert, Button, Input } from '$lib/components/ui';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	const urlError = page.url.searchParams.get('error');
	if (urlError === 'google_unconfigured') error = 'Google login belum dikonfigurasi.';
	else if (urlError) error = 'Google login gagal. Coba lagi.';

	async function submit(e: Event) {
		e.preventDefault();
		error = '';
		loading = true;
		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			});
			const data = await res.json();
			if (!res.ok) {
				error = data.error || 'Login gagal';
				return;
			}
			goto('/app');
		} finally {
			loading = false;
		}
	}
</script>

<AuthShell>
	<h1 class="text-xl font-semibold mb-1">Masuk ke Paperio</h1>
	<p class="text-sm text-[var(--fg-muted)] mb-6">Generator dokumen AI</p>

	{#if error}<Alert class="mb-4">{error}</Alert>{/if}

	<form onsubmit={submit} class="space-y-3">
		<Input bind:value={email} type="email" placeholder="Email" required />
		<Input bind:value={password} type="password" placeholder="Password" required />
		<Button type="submit" full {loading}>
			{loading ? 'Memproses…' : 'Masuk'}
		</Button>
	</form>

	<Divider />
	<GoogleButton />

	<div class="flex justify-between mt-5 text-sm">
		<a href="/auth/forgot" class="text-[var(--fg-muted)] hover:underline">Lupa password?</a>
		<a href="/auth/register" class="text-[var(--fg-interactive)] hover:underline">Daftar</a>
	</div>
</AuthShell>
