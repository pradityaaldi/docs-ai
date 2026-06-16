<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

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
			goto('/');
		} finally {
			loading = false;
		}
	}
</script>

<div class="min-h-dvh flex items-center justify-center p-4">
	<div class="w-full max-w-sm bg-[var(--bg-component)] border border-[var(--border-base)] rounded-xl p-8">
		<h1 class="text-xl font-semibold mb-1">Masuk ke Paperio</h1>
		<p class="text-sm text-[var(--fg-muted)] mb-6">Generator dokumen AI</p>

		{#if error}
			<div class="mb-4 text-sm text-[var(--fg-error)] bg-[var(--tag-red-bg,#fef2f2)] rounded-md px-3 py-2">{error}</div>
		{/if}

		<form onsubmit={submit} class="space-y-3">
			<input bind:value={email} type="email" placeholder="Email" required
				class="w-full bg-[var(--bg-field)] border border-[var(--border-base)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--border-interactive)]" />
			<input bind:value={password} type="password" placeholder="Password" required
				class="w-full bg-[var(--bg-field)] border border-[var(--border-base)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--border-interactive)]" />
			<button type="submit" disabled={loading}
				class="w-full py-2 bg-[var(--fg-interactive)] hover:opacity-90 disabled:opacity-50 rounded-lg text-sm font-medium text-[var(--fg-on-color)]">
				{loading ? 'Memproses…' : 'Masuk'}
			</button>
		</form>

		<div class="flex items-center gap-3 my-4">
			<div class="flex-1 h-px bg-[var(--border-base)]"></div>
			<span class="text-xs text-[var(--fg-muted)]">atau</span>
			<div class="flex-1 h-px bg-[var(--border-base)]"></div>
		</div>

		<a href="/auth/google"
			class="w-full flex items-center justify-center gap-2 py-2 border border-[var(--border-base)] rounded-lg text-sm font-medium hover:bg-[var(--bg-base-hover)]">
			<svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
			Lanjut dengan Google
		</a>

		<div class="flex justify-between mt-5 text-sm">
			<a href="/auth/forgot" class="text-[var(--fg-muted)] hover:underline">Lupa password?</a>
			<a href="/auth/register" class="text-[var(--fg-interactive)] hover:underline">Daftar</a>
		</div>
	</div>
</div>
