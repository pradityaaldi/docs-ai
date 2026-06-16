<script lang="ts">
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

<div class="min-h-dvh flex items-center justify-center p-4">
	<div class="w-full max-w-sm bg-[var(--bg-component)] border border-[var(--border-base)] rounded-xl p-8">
		{#if done}
			<div class="text-center">
				<div class="text-4xl mb-3">📧</div>
				<h1 class="text-lg font-semibold mb-1">Cek email kamu</h1>
				<p class="text-sm text-[var(--fg-muted)]">Kalau email terdaftar, kami kirim link reset password.</p>
				<a href="/auth/login" class="inline-block mt-4 text-sm text-[var(--fg-interactive)] underline">Ke login</a>
			</div>
		{:else}
			<h1 class="text-xl font-semibold mb-1">Lupa password</h1>
			<p class="text-sm text-[var(--fg-muted)] mb-6">Masukkan email, kami kirim link reset.</p>
			<form onsubmit={submit} class="space-y-3">
				<input bind:value={email} type="email" placeholder="Email" required
					class="w-full bg-[var(--bg-field)] border border-[var(--border-base)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--border-interactive)]" />
				<button type="submit" disabled={loading}
					class="w-full py-2 bg-[var(--fg-interactive)] hover:opacity-90 disabled:opacity-50 rounded-lg text-sm font-medium text-[var(--fg-on-color)]">
					{loading ? 'Mengirim…' : 'Kirim link reset'}
				</button>
			</form>
			<p class="text-center mt-5 text-sm">
				<a href="/auth/login" class="text-[var(--fg-interactive)] hover:underline">Kembali ke login</a>
			</p>
		{/if}
	</div>
</div>
