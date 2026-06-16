<script lang="ts">
	import '../../app.css';
	import { onMount } from 'svelte';
	import { Button, Card, Input, PageHeader, Select, StatCard, Tabs, ArrowLeftIcon, CheckIcon, CheckCircleIcon, XCircleIcon } from '$lib/components/ui';

	const TABS = [
		{ key: 'config', label: 'AI Config' },
		{ key: 'limits', label: 'Safety Limits' },
		{ key: 'monitor', label: 'Monitoring' },
		{ key: 'users', label: 'Aktivasi User' }
	];
	let tab = $state('config');

	let configs = $state<any[]>([]);
	let newCfg = $state({ provider: 'openai', model: '', baseUrl: '', apiKey: '' });
	let testMsg = $state('');
	let testOk = $state<boolean | null>(null);
	let cfgMsg = $state('');

	let limits = $state<any>(null);
	let limitsMsg = $state('');
	let limitsOk = $state<boolean | null>(null);

	let stats = $state<any>(null);

	let actEmail = $state('');
	let actPlan = $state('Basic');
	let actMsg = $state('');
	let actOk = $state<boolean | null>(null);

	async function loadConfigs() { configs = await (await fetch('/api/admin/ai-config')).json(); }
	async function loadLimits() { limits = await (await fetch('/api/admin/limits')).json(); }
	async function loadStats() { stats = await (await fetch('/api/admin/stats')).json(); }

	onMount(() => { loadConfigs(); loadLimits(); loadStats(); });

	async function addConfig() {
		cfgMsg = '';
		const res = await fetch('/api/admin/ai-config', {
			method: 'POST', headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(newCfg)
		});
		const d = await res.json();
		if (!res.ok) { cfgMsg = d.error || 'Gagal'; return; }
		newCfg = { provider: 'openai', model: '', baseUrl: '', apiKey: '' };
		await loadConfigs();
	}
	async function activate(id: string) { await fetch(`/api/admin/ai-config/${id}/activate`, { method: 'POST' }); await loadConfigs(); }
	async function delConfig(id: string) { await fetch(`/api/admin/ai-config/${id}`, { method: 'DELETE' }); await loadConfigs(); }
	async function testConfig(id: string) {
		testOk = null;
		testMsg = 'Testing…';
		const r = await (await fetch('/api/admin/ai-config/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })).json();
		testOk = !!r.success;
		testMsg = r.success ? 'Koneksi OK' : r.error;
	}

	async function saveLimits() {
		limitsMsg = '';
		const res = await fetch('/api/admin/limits', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(limits) });
		if (res.ok) { limits = await res.json(); limitsMsg = 'Tersimpan'; limitsOk = true; } else { limitsMsg = 'Gagal'; limitsOk = false; }
	}

	async function activateUser() {
		actMsg = '';
		const res = await fetch('/api/admin/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: actEmail, planName: actPlan }) });
		const d = await res.json();
		actOk = res.ok;
		actMsg = res.ok ? `Aktif s/d ${new Date(d.expires_at).toLocaleDateString('id-ID')}` : (d.error || 'Gagal');
	}
</script>

<div class="min-h-dvh bg-[var(--bg-base)]">
	<PageHeader title="Admin · Paperio">
		{#snippet actions()}
			<a href="/app" class="inline-flex items-center gap-1 text-sm text-[var(--fg-interactive)] hover:underline"><ArrowLeftIcon size={14} />Dashboard</a>
		{/snippet}
	</PageHeader>

	<div class="px-6 py-4 max-w-4xl mx-auto">
		<Tabs tabs={TABS} bind:active={tab} class="mb-6" />

		{#if tab === 'config'}
			<div class="space-y-4">
				{#each configs as c (c.id)}
					<Card rounded="lg" padding="sm" class="flex items-center gap-3">
						<span class="w-2 h-2 rounded-full {c.is_active ? 'bg-[var(--tag-green-text)]' : 'bg-[var(--fg-muted)]'}"></span>
						<div class="flex-1 min-w-0">
							<div class="text-sm font-medium">{c.provider} · {c.model}</div>
							<div class="text-xs text-[var(--fg-muted)] truncate">{c.base_url} · key {c.api_key}</div>
						</div>
						<Button variant="neutral" size="sm" onclick={() => testConfig(c.id)}>Test</Button>
						{#if !c.is_active}<Button size="sm" onclick={() => activate(c.id)}>Aktifkan</Button>{/if}
						<Button variant="ghost" size="sm" onclick={() => delConfig(c.id)}>Hapus</Button>
					</Card>
				{/each}
				{#if testMsg}
					<p class="text-sm flex items-center gap-1.5">
						{#if testOk === true}<CheckCircleIcon size={15} class="shrink-0 text-[var(--tag-green-text)]" />{:else if testOk === false}<XCircleIcon size={15} class="shrink-0 text-[var(--fg-error)]" />{/if}
						{testMsg}
					</p>
				{/if}

				<Card rounded="lg" padding="sm" class="space-y-3">
					<h3 class="text-sm font-medium">Tambah AI Config</h3>
					<div class="grid grid-cols-2 gap-3">
						<Select bind:value={newCfg.provider}>
							<option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="gemini">Gemini</option>
						</Select>
						<Input bind:value={newCfg.model} placeholder="model (gpt-4o, claude-…)" />
						<Input bind:value={newCfg.baseUrl} placeholder="base url (kosongkan = default)" />
						<Input bind:value={newCfg.apiKey} type="password" placeholder="API key" />
					</div>
					<Button onclick={addConfig}>Simpan</Button>
					{#if cfgMsg}<span class="text-sm text-[var(--fg-error)] ml-2">{cfgMsg}</span>{/if}
				</Card>
			</div>
		{:else if tab === 'limits' && limits}
			<Card rounded="lg" class="space-y-3 max-w-md">
				<label class="flex items-center gap-2 text-sm"><input type="checkbox" bind:checked={limits.enabled} /> AI aktif (kill switch)</label>
				<label class="block text-sm">Cap token harian global<Input type="number" bind:value={limits.daily_token_cap} class="mt-1" /></label>
				<label class="block text-sm">Cap biaya bulanan ($)<Input type="number" step="0.01" bind:value={limits.monthly_cost_cap} class="mt-1" /></label>
				<label class="block text-sm">Cap token harian per-user<Input type="number" bind:value={limits.per_user_daily_cap} class="mt-1" /></label>
				<label class="block text-sm">Rate limit (req/menit/user)<Input type="number" bind:value={limits.rate_per_min} class="mt-1" /></label>
				<label class="block text-sm">Max token / request<Input type="number" bind:value={limits.max_tokens_per_req} class="mt-1" /></label>
				<label class="block text-sm">Warn threshold (%)<Input type="number" bind:value={limits.warn_threshold_pct} class="mt-1" /></label>
				<Button onclick={saveLimits}>Simpan</Button>
				{#if limitsMsg}<span class="text-sm ml-2 inline-flex items-center gap-1">{#if limitsOk}<CheckIcon size={14} class="shrink-0 text-[var(--tag-green-text)]" />{/if}{limitsMsg}</span>{/if}
			</Card>
		{:else if tab === 'monitor' && stats}
			<div class="space-y-5">
				<div class="grid grid-cols-3 gap-4">
					<StatCard label="Token hari ini" value={stats.today.tokens.toLocaleString()} />
					<StatCard label="Generate bulan ini" value={stats.month.count} />
					<StatCard label="Biaya bulan ini" value={`$${stats.month.cost.toFixed(2)}`} />
					<StatCard label="Error rate" value={`${(stats.month.errorRate * 100).toFixed(1)}%`} />
					<StatCard label="Avg latency" value={`${stats.month.avgLatencyMs}ms`} />
					<StatCard label="Token bulan ini" value={stats.month.tokens.toLocaleString()} />
				</div>
				<div>
					<h3 class="text-sm font-medium mb-2">Per kategori</h3>
					<div class="flex gap-3">
						{#each stats.byCategory as c}<div class="bg-[var(--bg-component)] border border-[var(--border-base)] rounded px-3 py-2 text-sm capitalize">{c.category}: <b>{c.count}</b></div>{/each}
					</div>
				</div>
				<div>
					<h3 class="text-sm font-medium mb-2">Top users</h3>
					<table class="w-full text-sm">
						<thead><tr class="text-left text-[var(--fg-muted)]"><th class="py-1">Email</th><th>Token</th><th>Generate</th></tr></thead>
						<tbody>
							{#each stats.topUsers as u}<tr class="border-t border-[var(--border-base)]"><td class="py-1">{u.email}</td><td>{u.tokens.toLocaleString()}</td><td>{u.count}</td></tr>{/each}
						</tbody>
					</table>
				</div>
			</div>
		{:else if tab === 'users'}
			<Card rounded="lg" class="space-y-3 max-w-md">
				<h3 class="text-sm font-medium">Aktifkan langganan manual (fallback)</h3>
				<Input bind:value={actEmail} placeholder="email user" />
				<Select bind:value={actPlan}>
					<option>Free Trial</option><option>Basic</option><option>Pro</option>
				</Select>
				<Button onclick={activateUser}>Aktifkan</Button>
				{#if actMsg}
					<p class="text-sm flex items-center gap-1.5">
						{#if actOk === true}<CheckCircleIcon size={15} class="shrink-0 text-[var(--tag-green-text)]" />{:else if actOk === false}<XCircleIcon size={15} class="shrink-0 text-[var(--fg-error)]" />{/if}
						{actMsg}
					</p>
				{/if}
			</Card>
		{/if}
	</div>
</div>
