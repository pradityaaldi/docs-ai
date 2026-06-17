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

	// Dev-only quick login. import.meta.env.DEV is false in prod builds, so this
	// list and the buttons below are dead-code-eliminated for production.
	const DEV = import.meta.env.DEV;
	const testAccounts = [
		{ label: 'Admin', email: 'admin@paperio.test', password: 'admin12345' },
		{ label: 'Sari (user)', email: 'sari@test.com', password: 'password123' }
	];

	const urlError = page.url.searchParams.get('error');
	if (urlError === 'google_unconfigured') error = 'Google login belum dikonfigurasi.';
	else if (urlError) error = 'Google login gagal. Coba lagi.';

	async function login(em: string, pw: string) {
		error = '';
		loading = true;
		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: em, password: pw })
			});
			const data = await res.json();
			if (!res.ok) {
				error = data.error || 'Login gagal';
				return;
			}
			goto(data.user?.role === 'admin' ? '/manage' : '/app');
		} finally {
			loading = false;
		}
	}

	function submit(e: Event) {
		e.preventDefault();
		login(email, password);
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

	{#if DEV}
		<div class="mt-6 pt-4 border-t border-[var(--border-base)]">
			<p class="text-[11px] uppercase tracking-wide text-[var(--fg-muted)] mb-2">
				Dev quick login
			</p>
			<div class="flex gap-2">
				{#each testAccounts as acc}
					<Button
						variant="neutral"
						size="sm"
						full
						disabled={loading}
						onclick={() => login(acc.email, acc.password)}
					>
						{acc.label}
					</Button>
				{/each}
			</div>
		</div>
	{/if}
</AuthShell>
