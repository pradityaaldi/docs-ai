<script lang="ts">
	import '../../app.css';
	import { onMount } from 'svelte';

	type Tab = 'config' | 'limits' | 'monitor' | 'users';
	let tab = $state<Tab>('config');

	// AI config
	let configs = $state<any[]>([]);
	let newCfg = $state({ provider: 'openai', model: '', baseUrl: '', apiKey: '' });
	let testMsg = $state('');
	let cfgMsg = $state('');

	// limits
	let limits = $state<any>(null);
	let limitsMsg = $state('');

	// monitor
	let stats = $state<any>(null);

	// users activate
	let actEmail = $state('');
	let actPlan = $state('Basic');
	let actMsg = $state('');

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
		testMsg = 'Testing…';
		const r = await (await fetch('/api/admin/ai-config/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })).json();
		testMsg = r.success ? '✅ Koneksi OK' : `❌ ${r.error}`;
	}

	async function saveLimits() {
		limitsMsg = '';
		const res = await fetch('/api/admin/limits', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(limits) });
		if (res.ok) { limits = await res.json(); limitsMsg = 'Tersimpan ✓'; } else limitsMsg = 'Gagal';
	}

	async function activateUser() {
		actMsg = '';
		const res = await fetch('/api/admin/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: actEmail, planName: actPlan }) });
		const d = await res.json();
		actMsg = res.ok ? `✅ Aktif s/d ${new Date(d.expires_at).toLocaleDateString('id-ID')}` : (d.error || 'Gagal');
	}
</script>

<div class="min-h-dvh bg-[var(--bg-base)]">
	<header class="border-b border-[var(--border-base)] px-6 py-4 flex items-center justify-between">
		<h1 class="text-lg font-semibold">Admin · Paperio</h1>
		<a href="/" class="text-sm text-[var(--fg-interactive)] hover:underline">← Dashboard</a>
	</header>

	<div class="px-6 py-4 max-w-4xl mx-auto">
		<div class="flex gap-2 mb-6">
			{#each [['config','AI Config'],['limits','Safety Limits'],['monitor','Monitoring'],['users','Aktivasi User']] as [k,label]}
				<button onclick={() => tab = k as Tab}
					class="px-3 py-1.5 rounded-full text-sm {tab === k ? 'bg-[var(--fg-interactive)] text-[var(--fg-on-color)]' : 'bg-[var(--bg-component)] border border-[var(--border-base)] text-[var(--fg-subtle)]'}">{label}</button>
			{/each}
		</div>

		{#if tab === 'config'}
			<div class="space-y-4">
				{#each configs as c (c.id)}
					<div class="flex items-center gap-3 bg-[var(--bg-component)] border border-[var(--border-base)] rounded-lg p-4">
						<span class="w-2 h-2 rounded-full {c.is_active ? 'bg-[var(--tag-green-text)]' : 'bg-[var(--fg-muted)]'}"></span>
						<div class="flex-1 min-w-0">
							<div class="text-sm font-medium">{c.provider} · {c.model}</div>
							<div class="text-xs text-[var(--fg-muted)] truncate">{c.base_url} · key {c.api_key}</div>
						</div>
						<button onclick={() => testConfig(c.id)} class="text-xs px-2 py-1 border border-[var(--border-base)] rounded">Test</button>
						{#if !c.is_active}<button onclick={() => activate(c.id)} class="text-xs px-2 py-1 bg-[var(--fg-interactive)] text-[var(--fg-on-color)] rounded">Aktifkan</button>{/if}
						<button onclick={() => delConfig(c.id)} class="text-xs px-2 py-1 text-[var(--fg-error)]">Hapus</button>
					</div>
				{/each}
				{#if testMsg}<p class="text-sm">{testMsg}</p>{/if}

				<div class="bg-[var(--bg-component)] border border-[var(--border-base)] rounded-lg p-4 space-y-3">
					<h3 class="text-sm font-medium">Tambah AI Config</h3>
					<div class="grid grid-cols-2 gap-3">
						<select bind:value={newCfg.provider} class="bg-[var(--bg-field)] border border-[var(--border-base)] rounded px-3 py-2 text-sm">
							<option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="gemini">Gemini</option>
						</select>
						<input bind:value={newCfg.model} placeholder="model (gpt-4o, claude-…)" class="bg-[var(--bg-field)] border border-[var(--border-base)] rounded px-3 py-2 text-sm" />
						<input bind:value={newCfg.baseUrl} placeholder="base url (kosongkan = default)" class="bg-[var(--bg-field)] border border-[var(--border-base)] rounded px-3 py-2 text-sm" />
						<input bind:value={newCfg.apiKey} type="password" placeholder="API key" class="bg-[var(--bg-field)] border border-[var(--border-base)] rounded px-3 py-2 text-sm" />
					</div>
					<button onclick={addConfig} class="px-3 py-2 bg-[var(--fg-interactive)] text-[var(--fg-on-color)] rounded text-sm">Simpan</button>
					{#if cfgMsg}<span class="text-sm text-[var(--fg-error)] ml-2">{cfgMsg}</span>{/if}
				</div>
			</div>
		{:else if tab === 'limits' && limits}
			<div class="bg-[var(--bg-component)] border border-[var(--border-base)] rounded-lg p-5 space-y-3 max-w-md">
				<label class="flex items-center gap-2 text-sm"><input type="checkbox" bind:checked={limits.enabled} /> AI aktif (kill switch)</label>
				<label class="block text-sm">Cap token harian global<input type="number" bind:value={limits.daily_token_cap} class="mt-1 w-full bg-[var(--bg-field)] border border-[var(--border-base)] rounded px-3 py-2" /></label>
				<label class="block text-sm">Cap biaya bulanan ($)<input type="number" step="0.01" bind:value={limits.monthly_cost_cap} class="mt-1 w-full bg-[var(--bg-field)] border border-[var(--border-base)] rounded px-3 py-2" /></label>
				<label class="block text-sm">Cap token harian per-user<input type="number" bind:value={limits.per_user_daily_cap} class="mt-1 w-full bg-[var(--bg-field)] border border-[var(--border-base)] rounded px-3 py-2" /></label>
				<label class="block text-sm">Rate limit (req/menit/user)<input type="number" bind:value={limits.rate_per_min} class="mt-1 w-full bg-[var(--bg-field)] border border-[var(--border-base)] rounded px-3 py-2" /></label>
				<label class="block text-sm">Max token / request<input type="number" bind:value={limits.max_tokens_per_req} class="mt-1 w-full bg-[var(--bg-field)] border border-[var(--border-base)] rounded px-3 py-2" /></label>
				<label class="block text-sm">Warn threshold (%)<input type="number" bind:value={limits.warn_threshold_pct} class="mt-1 w-full bg-[var(--bg-field)] border border-[var(--border-base)] rounded px-3 py-2" /></label>
				<button onclick={saveLimits} class="px-3 py-2 bg-[var(--fg-interactive)] text-[var(--fg-on-color)] rounded text-sm">Simpan</button>
				{#if limitsMsg}<span class="text-sm ml-2">{limitsMsg}</span>{/if}
			</div>
		{:else if tab === 'monitor' && stats}
			<div class="space-y-5">
				<div class="grid grid-cols-3 gap-4">
					<div class="bg-[var(--bg-component)] border border-[var(--border-base)] rounded-lg p-4"><div class="text-xs text-[var(--fg-muted)]">Token hari ini</div><div class="text-xl font-bold">{stats.today.tokens.toLocaleString()}</div></div>
					<div class="bg-[var(--bg-component)] border border-[var(--border-base)] rounded-lg p-4"><div class="text-xs text-[var(--fg-muted)]">Generate bulan ini</div><div class="text-xl font-bold">{stats.month.count}</div></div>
					<div class="bg-[var(--bg-component)] border border-[var(--border-base)] rounded-lg p-4"><div class="text-xs text-[var(--fg-muted)]">Biaya bulan ini</div><div class="text-xl font-bold">${stats.month.cost.toFixed(2)}</div></div>
					<div class="bg-[var(--bg-component)] border border-[var(--border-base)] rounded-lg p-4"><div class="text-xs text-[var(--fg-muted)]">Error rate</div><div class="text-xl font-bold">{(stats.month.errorRate * 100).toFixed(1)}%</div></div>
					<div class="bg-[var(--bg-component)] border border-[var(--border-base)] rounded-lg p-4"><div class="text-xs text-[var(--fg-muted)]">Avg latency</div><div class="text-xl font-bold">{stats.month.avgLatencyMs}ms</div></div>
					<div class="bg-[var(--bg-component)] border border-[var(--border-base)] rounded-lg p-4"><div class="text-xs text-[var(--fg-muted)]">Token bulan ini</div><div class="text-xl font-bold">{stats.month.tokens.toLocaleString()}</div></div>
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
			<div class="bg-[var(--bg-component)] border border-[var(--border-base)] rounded-lg p-5 space-y-3 max-w-md">
				<h3 class="text-sm font-medium">Aktifkan langganan manual (fallback)</h3>
				<input bind:value={actEmail} placeholder="email user" class="w-full bg-[var(--bg-field)] border border-[var(--border-base)] rounded px-3 py-2 text-sm" />
				<select bind:value={actPlan} class="w-full bg-[var(--bg-field)] border border-[var(--border-base)] rounded px-3 py-2 text-sm">
					<option>Free Trial</option><option>Basic</option><option>Pro</option>
				</select>
				<button onclick={activateUser} class="px-3 py-2 bg-[var(--fg-interactive)] text-[var(--fg-on-color)] rounded text-sm">Aktifkan</button>
				{#if actMsg}<p class="text-sm">{actMsg}</p>{/if}
			</div>
		{/if}
	</div>
</div>
