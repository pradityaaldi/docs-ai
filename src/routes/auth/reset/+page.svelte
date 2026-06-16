<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

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

<div class="min-h-dvh flex items-center justify-center p-4">
	<div class="w-full max-w-sm bg-[var(--bg-component)] border border-[var(--border-base)] rounded-xl p-8">
		{#if done}
			<div class="text-center">
				<div class="text-4xl mb-3">✅</div>
				<h1 class="text-lg font-semibold mb-1">Password diganti</h1>
				<p class="text-sm text-[var(--fg-muted)]">Mengarahkan ke login…</p>
			</div>
		{:else}
			<h1 class="text-xl font-semibold mb-1">Reset password</h1>
			<p class="text-sm text-[var(--fg-muted)] mb-6">Masukkan password baru.</p>
			{#if error}
				<div class="mb-4 text-sm text-[var(--fg-error)] bg-[var(--tag-red-bg,#fef2f2)] rounded-md px-3 py-2">{error}</div>
			{/if}
			<form onsubmit={submit} class="space-y-3">
				<input bind:value={password} type="password" placeholder="Password baru (min 8 karakter)" required
					class="w-full bg-[var(--bg-field)] border border-[var(--border-base)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--border-interactive)]" />
				<button type="submit" disabled={loading || !token}
					class="w-full py-2 bg-[var(--fg-interactive)] hover:opacity-90 disabled:opacity-50 rounded-lg text-sm font-medium text-[var(--fg-on-color)]">
					{loading ? 'Memproses…' : 'Ganti password'}
				</button>
			</form>
		{/if}
	</div>
</div>
