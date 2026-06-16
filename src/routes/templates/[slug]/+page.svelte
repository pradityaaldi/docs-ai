<script lang="ts">
	import '../../../app.css';
	import { goto } from '$app/navigation';
	let { data } = $props();

	const fields = data.template.formFields ?? [];
	const values = $state<Record<string, string>>(
		Object.fromEntries(
			fields.map((f) => [f.key, f.type === 'select' && f.options?.length ? f.options[0] : ''])
		)
	);

	let error = $state('');
	let loading = $state(false);

	async function submit(e: Event) {
		e.preventDefault();
		error = '';
		// required validation
		for (const f of fields) {
			if (f.required && !values[f.key]?.trim?.()) {
				error = `${f.label} wajib diisi`;
				return;
			}
		}
		loading = true;
		try {
			const res = await fetch('/api/projects/from-template', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ slug: data.template.slug, input: values })
			});
			const proj = await res.json();
			if (!res.ok) {
				error = proj.error || 'Gagal membuat project';
				return;
			}
			goto(`/?project=${proj.id}`);
		} finally {
			loading = false;
		}
	}
</script>

<div class="min-h-dvh bg-[var(--bg-base)] flex justify-center">
	<div class="w-full max-w-xl px-6 py-8">
		<a href="/templates" class="text-sm text-[var(--fg-interactive)] hover:underline">← Galeri</a>

		<div class="mt-4 mb-6">
			<h1 class="text-xl font-semibold">{data.template.name}</h1>
			{#if data.template.kampus}<p class="text-sm text-[var(--fg-muted)]">{data.template.kampus}</p>{/if}
			<p class="text-sm text-[var(--fg-muted)] mt-1">{data.template.description}</p>
		</div>

		{#if error}
			<div class="mb-4 text-sm text-[var(--fg-error)] bg-[var(--tag-red-bg,#fef2f2)] rounded-md px-3 py-2">{error}</div>
		{/if}

		<form onsubmit={submit} class="space-y-4 bg-[var(--bg-component)] border border-[var(--border-base)] rounded-xl p-6">
			{#each fields as f (f.key)}
				<div>
					<label for={f.key} class="block text-sm font-medium mb-1">
						{f.label}{#if f.required}<span class="text-[var(--fg-error)]"> *</span>{/if}
					</label>
					{#if f.type === 'textarea'}
						<textarea id={f.key} bind:value={values[f.key]} placeholder={f.placeholder ?? ''} rows="3"
							class="w-full bg-[var(--bg-field)] border border-[var(--border-base)] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--border-interactive)]"></textarea>
					{:else if f.type === 'select'}
						<select id={f.key} bind:value={values[f.key]}
							class="w-full bg-[var(--bg-field)] border border-[var(--border-base)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--border-interactive)]">
							{#each f.options ?? [] as opt}<option value={opt}>{opt}</option>{/each}
						</select>
					{:else}
						<input id={f.key} type="text" bind:value={values[f.key]} placeholder={f.placeholder ?? ''}
							class="w-full bg-[var(--bg-field)] border border-[var(--border-base)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--border-interactive)]" />
					{/if}
				</div>
			{/each}

			<button type="submit" disabled={loading}
				class="w-full py-2.5 bg-[var(--fg-interactive)] hover:opacity-90 disabled:opacity-50 rounded-lg text-sm font-medium text-[var(--fg-on-color)]">
				{loading ? 'Membuat project…' : 'Buat Project'}
			</button>
			<p class="text-xs text-[var(--fg-muted)] text-center">Setelah dibuat, kamu bisa generate dokumen sekali klik.</p>
		</form>
	</div>
</div>
