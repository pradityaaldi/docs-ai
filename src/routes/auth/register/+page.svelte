<script lang="ts">
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

<div class="min-h-dvh flex items-center justify-center p-4">
	<div class="w-full max-w-sm bg-[var(--bg-component)] border border-[var(--border-base)] rounded-xl p-8">
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

			{#if error}
				<div class="mb-4 text-sm text-[var(--fg-error)] bg-[var(--tag-red-bg,#fef2f2)] rounded-md px-3 py-2">{error}</div>
			{/if}

			<form onsubmit={submit} class="space-y-3">
				<input bind:value={name} type="text" placeholder="Nama"
					class="w-full bg-[var(--bg-field)] border border-[var(--border-base)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--border-interactive)]" />
				<input bind:value={email} type="email" placeholder="Email" required
					class="w-full bg-[var(--bg-field)] border border-[var(--border-base)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--border-interactive)]" />
				<input bind:value={password} type="password" placeholder="Password (min 8 karakter)" required
					class="w-full bg-[var(--bg-field)] border border-[var(--border-base)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--border-interactive)]" />
				<button type="submit" disabled={loading}
					class="w-full py-2 bg-[var(--fg-interactive)] hover:opacity-90 disabled:opacity-50 rounded-lg text-sm font-medium text-[var(--fg-on-color)]">
					{loading ? 'Memproses…' : 'Daftar'}
				</button>
			</form>

			<div class="flex items-center gap-3 my-4">
				<div class="flex-1 h-px bg-[var(--border-base)]"></div>
				<span class="text-xs text-[var(--fg-muted)]">atau</span>
				<div class="flex-1 h-px bg-[var(--border-base)]"></div>
			</div>

			<a href="/auth/google"
				class="w-full flex items-center justify-center gap-2 py-2 border border-[var(--border-base)] rounded-lg text-sm font-medium hover:bg-[var(--bg-base-hover)]">
				Lanjut dengan Google
			</a>

			<p class="text-center mt-5 text-sm text-[var(--fg-muted)]">
				Sudah punya akun? <a href="/auth/login" class="text-[var(--fg-interactive)] hover:underline">Masuk</a>
			</p>
		{/if}
	</div>
</div>
