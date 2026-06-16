<script lang="ts">
	import '../../../app.css';
	import { goto } from '$app/navigation';
	import { Alert, Button, Card, Field, Input, Select, Textarea } from '$lib/components/ui';
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

		{#if error}<Alert class="mb-4">{error}</Alert>{/if}

		<Card padding="none">
			<form onsubmit={submit} class="space-y-4 p-6">
				{#each fields as f (f.key)}
					<Field label={f.label} forId={f.key} required={f.required}>
						{#if f.type === 'textarea'}
							<Textarea id={f.key} bind:value={values[f.key]} placeholder={f.placeholder ?? ''} />
						{:else if f.type === 'select'}
							<Select id={f.key} bind:value={values[f.key]}>
								{#each f.options ?? [] as opt}<option value={opt}>{opt}</option>{/each}
							</Select>
						{:else}
							<Input id={f.key} type="text" bind:value={values[f.key]} placeholder={f.placeholder ?? ''} />
						{/if}
					</Field>
				{/each}

				<Button type="submit" full {loading} class="py-2.5">
					{loading ? 'Membuat project…' : 'Buat Project'}
				</Button>
				<p class="text-xs text-[var(--fg-muted)] text-center">Setelah dibuat, kamu bisa generate dokumen sekali klik.</p>
			</form>
		</Card>
	</div>
</div>
