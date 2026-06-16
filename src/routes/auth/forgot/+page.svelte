<script lang="ts">
	import AuthShell from '$lib/components/auth/AuthShell.svelte';
	import { Button, Input, MailIcon } from '$lib/components/ui';

	let email = $state('');
	let loading = $state(false);
	let done = $state(false);

	async function submit(e: Event) {
		e.preventDefault();
		loading = true;
		try {
			await fetch('/api/auth/forgot', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email })
			});
			done = true;
		} finally {
			loading = false;
		}
	}
</script>

<AuthShell>
	{#if done}
		<div class="text-center">
			<div class="flex justify-center mb-3 text-[var(--fg-interactive)]"><MailIcon size={40} /></div>
			<h1 class="text-lg font-semibold mb-1">Cek email kamu</h1>
			<p class="text-sm text-[var(--fg-muted)]">Kalau email terdaftar, kami kirim link reset password.</p>
			<a href="/auth/login" class="inline-block mt-4 text-sm text-[var(--fg-interactive)] underline">Ke login</a>
		</div>
	{:else}
		<h1 class="text-xl font-semibold mb-1">Lupa password</h1>
		<p class="text-sm text-[var(--fg-muted)] mb-6">Masukkan email, kami kirim link reset.</p>
		<form onsubmit={submit} class="space-y-3">
			<Input bind:value={email} type="email" placeholder="Email" required />
			<Button type="submit" full {loading}>
				{loading ? 'Mengirim…' : 'Kirim link reset'}
			</Button>
		</form>
		<p class="text-center mt-5 text-sm">
			<a href="/auth/login" class="text-[var(--fg-interactive)] hover:underline">Kembali ke login</a>
		</p>
	{/if}
</AuthShell>
