<script lang="ts">
	import '../../app.css';
	import { onMount } from 'svelte';
	import { Badge, Button, Card, Input, PageHeader, Select, StatCard, Tabs, ArrowLeftIcon, CheckIcon, CheckCircleIcon, XCircleIcon } from '$lib/components/ui';
	import { PROVIDER_IDS, PROVIDER_LABELS, PROVIDER_MODELS } from '$lib/shared/providers';

	const TABS = [
		{ key: 'config', label: 'AI Config' },
		{ key: 'users', label: 'Pengguna' },
		{ key: 'monitor', label: 'Monitoring' },
		{ key: 'limits', label: 'Safety Limits' },
		{ key: 'activate', label: 'Aktivasi User' }
	];
	let tab = $state('config');

	let userList = $state<any[]>([]);
	async function loadUsers() { userList = await (await fetch('/api/admin/users')).json(); }
	function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }

	// Provider/model catalog lives in $lib/shared/providers (single source).
	const MODELS = PROVIDER_MODELS as Record<string, string[]>;

	type CfgForm = { provider: string; model: string; baseUrl: string; apiKey: string };
	let configs = $state<any[]>([]);
	let newCfg = $state<CfgForm>({ provider: 'gemini', model: 'gemini-2.5-flash-lite', baseUrl: '', apiKey: '' });

	// Keep model valid for the selected provider (call on provider change).
	function syncModel(cfg: CfgForm) {
		const list = MODELS[cfg.provider] ?? [];
		if (!list.includes(cfg.model)) cfg.model = list[0] ?? '';
	}
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

	onMount(() => { loadConfigs(); loadLimits(); loadStats(); loadUsers(); });

	async function addConfig() {
		cfgMsg = '';
		const res = await fetch('/api/admin/ai-config', {
			method: 'POST', headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(newCfg)
		});
		const d = await res.json();
		if (!res.ok) { cfgMsg = d.error || 'Gagal'; return; }
		newCfg = { provider: 'gemini', model: 'gemini-2.5-flash-lite', baseUrl: '', apiKey: '' };
		await loadConfigs();
	}
	// Inline edit of an existing config (change model/key/base without re-adding).
	let editId = $state<string | null>(null);
	let editCfg = $state<CfgForm>({ provider: '', model: '', baseUrl: '', apiKey: '' });
	function startEdit(c: any) {
		editId = c.id;
		editCfg = { provider: c.provider, model: c.model, baseUrl: c.base_url, apiKey: '' };
	}
	function cancelEdit() { editId = null; }
	async function saveEdit() {
		cfgMsg = '';
		const res = await fetch(`/api/admin/ai-config/${editId}`, {
			method: 'PUT', headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(editCfg)
		});
		const d = await res.json();
		if (!res.ok) { cfgMsg = d.error || 'Gagal'; return; }
		editId = null;
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
	<PageHeader title="Kelola · Paperio">
		{#snippet actions()}
			<a href="/app" class="inline-flex items-center gap-1 text-sm text-[var(--fg-interactive)] hover:underline"><ArrowLeftIcon size={14} />Dashboard</a>
		{/snippet}
	</PageHeader>

	<div class="px-6 py-4 max-w-4xl mx-auto">
		<Tabs tabs={TABS} bind:active={tab} class="mb-6" />

		{#snippet cfgFields(cfg: CfgForm, keyPlaceholder: string)}
			<div class="grid grid-cols-2 gap-3">
				<Select bind:value={cfg.provider} onchange={() => syncModel(cfg)}>
					{#each PROVIDER_IDS as p}<option value={p}>{PROVIDER_LABELS[p]}</option>{/each}
				</Select>
				<Select bind:value={cfg.model}>
					{#each MODELS[cfg.provider] ?? [] as m}<option value={m}>{m}</option>{/each}
				</Select>
				<Input bind:value={cfg.baseUrl} placeholder="base url (kosongkan = default)" />
				<Input bind:value={cfg.apiKey} type="password" placeholder={keyPlaceholder} />
			</div>
		{/snippet}

		{#if tab === 'config'}
			<div class="space-y-4">
				{#each configs as c (c.id)}
					{#if editId === c.id}
						<Card rounded="lg" padding="sm" class="space-y-3">
							<h3 class="text-sm font-medium">Ubah config</h3>
							{@render cfgFields(editCfg, 'API key (kosongkan = tetap)')}
							<div class="flex gap-2">
								<Button size="sm" onclick={saveEdit}>Simpan</Button>
								<Button variant="ghost" size="sm" onclick={cancelEdit}>Batal</Button>
							</div>
							{#if cfgMsg}<span class="text-sm text-[var(--fg-error)] ml-2">{cfgMsg}</span>{/if}
						</Card>
					{:else}
						<Card rounded="lg" padding="sm" class="flex items-center gap-3">
							<span class="w-2 h-2 rounded-full {c.is_active ? 'bg-[var(--tag-green-text)]' : 'bg-[var(--fg-muted)]'}"></span>
							<div class="flex-1 min-w-0">
								<div class="text-sm font-medium">{c.provider} · {c.model}</div>
								<div class="text-xs text-[var(--fg-muted)] truncate">{c.base_url} · key {c.api_key}</div>
							</div>
							<Button variant="neutral" size="sm" onclick={() => testConfig(c.id)}>Test</Button>
							<Button variant="neutral" size="sm" onclick={() => startEdit(c)}>Ubah</Button>
							{#if !c.is_active}<Button size="sm" onclick={() => activate(c.id)}>Aktifkan</Button>{/if}
							<Button variant="ghost" size="sm" onclick={() => delConfig(c.id)}>Hapus</Button>
						</Card>
					{/if}
				{/each}
				{#if testMsg}
					<p class="text-sm flex items-center gap-1.5">
						{#if testOk === true}<CheckCircleIcon size={15} class="shrink-0 text-[var(--tag-green-text)]" />{:else if testOk === false}<XCircleIcon size={15} class="shrink-0 text-[var(--fg-error)]" />{/if}
						{testMsg}
					</p>
				{/if}

				<Card rounded="lg" padding="sm" class="space-y-3">
					<h3 class="text-sm font-medium">Tambah AI Config</h3>
					{@render cfgFields(newCfg, 'API key')}
					<Button onclick={addConfig}>Simpan</Button>
					{#if cfgMsg && editId === null}<span class="text-sm text-[var(--fg-error)] ml-2">{cfgMsg}</span>{/if}
				</Card>
			</div>
		{:else if tab === 'users'}
			<div class="space-y-3">
				<h3 class="text-sm font-medium">Semua pengguna ({userList.length})</h3>
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="text-left text-[var(--fg-muted)]">
								<th class="py-1 font-medium">Email</th>
								<th class="font-medium">Role</th>
								<th class="font-medium text-right">Token</th>
								<th class="font-medium text-right">Generate</th>
								<th class="font-medium text-right">Biaya</th>
								<th class="font-medium text-right">Terakhir aktif</th>
							</tr>
						</thead>
						<tbody>
							{#each userList as u (u.id)}
								<tr class="border-t border-[var(--border-base)]">
									<td class="py-1.5">
										<div class="font-medium">{u.email}</div>
										{#if u.name}<div class="text-xs text-[var(--fg-muted)]">{u.name}</div>{/if}
									</td>
									<td><Badge variant={u.role === 'admin' ? 'info' : 'neutral'}>{u.role}</Badge></td>
									<td class="text-right tabular-nums">{u.tokens.toLocaleString()}</td>
									<td class="text-right tabular-nums">{u.count}</td>
									<td class="text-right tabular-nums">${u.cost.toFixed(2)}</td>
									<td class="text-right text-[var(--fg-muted)]">{fmtDate(u.last_active)}</td>
								</tr>
							{/each}
							{#if !userList.length}
								<tr><td colspan="6" class="py-3 text-center text-[var(--fg-muted)]">Belum ada pengguna</td></tr>
							{/if}
						</tbody>
					</table>
				</div>
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
		{:else if tab === 'activate'}
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
