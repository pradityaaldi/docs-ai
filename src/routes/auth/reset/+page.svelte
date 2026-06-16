<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import AuthShell from '$lib/components/auth/AuthShell.svelte';
	import { Alert, Button, Input, CheckCircleIcon } from '$lib/components/ui';

	const token = page.url.searchParams.get('token') || '';
	let password = $state('');
	let error = $state('');
	let loading = $state(false);
	let done = $state(false);

	async function submit(e: Event) {
		e.preventDefault();
		error = '';
		loading = true;
		try {
			const res = await fetch('/api/auth/reset', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token, password })
			});
			const data = await res.json();
			if (!res.ok) {
				error = data.error || 'Reset gagal';
				return;
			}
			done = true;
			setTimeout(() => goto('/auth/login'), 1500);
		} finally {
			loading = false;
		}
	}
</script>

<AuthShell>
	{#if done}
		<div class="text-center">
			<div class="flex justify-center mb-3 text-[var(--tag-green-text)]"><CheckCircleIcon size={40} /></div>
			<h1 class="text-lg font-semibold mb-1">Password diganti</h1>
			<p class="text-sm text-[var(--fg-muted)]">Mengarahkan ke login…</p>
		</div>
	{:else}
		<h1 class="text-xl font-semibold mb-1">Reset password</h1>
		<p class="text-sm text-[var(--fg-muted)] mb-6">Masukkan password baru.</p>
		{#if error}<Alert class="mb-4">{error}</Alert>{/if}
		<form onsubmit={submit} class="space-y-3">
			<Input bind:value={password} type="password" placeholder="Password baru (min 8 karakter)" required />
			<Button type="submit" full {loading} disabled={loading || !token}>
				{loading ? 'Memproses…' : 'Ganti password'}
			</Button>
		</form>
	{/if}
</AuthShell>
