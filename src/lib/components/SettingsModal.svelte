<script lang="ts">
	import { app, type Connector } from '$lib/stores/app.svelte';
	import { loadConnectors } from '$lib/actions';

	type ConnectorForm = { name: string; provider: string; base_url: string; model_name: string; api_key: string };

	const emptyForm = (): ConnectorForm => ({ name: '', provider: 'openai', base_url: '', model_name: '', api_key: '' });

	let newConnector = $state<ConnectorForm>(emptyForm());
	let testingConnector = $state(false);
	let testResult = $state<{ success: boolean; error?: string } | null>(null);

	// Edit state
	let editingId = $state<string | null>(null);
	let editConnector = $state<ConnectorForm>(emptyForm());
	let editTesting = $state(false);
	let editTestResult = $state<{ success: boolean; error?: string } | null>(null);
	let saving = $state(false);

	async function testConnector(form: ConnectorForm): Promise<{ success: boolean; error?: string }> {
		try {
			const res = await fetch('/api/connectors/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					provider: form.provider,
					base_url: form.base_url,
					model_name: form.model_name,
					api_key: form.api_key
				})
			});
			return await res.json();
		} catch (e) {
			return { success: false, error: (e as Error).message };
		}
	}

	async function handleTest() {
		testingConnector = true;
		testResult = null;
		testResult = await testConnector(newConnector);
		testingConnector = false;
	}

	async function handleSave() {
		saving = true;
		await fetch('/api/connectors', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(newConnector)
		});
		await loadConnectors();
		newConnector = emptyForm();
		testResult = null;
		saving = false;
		app.showSettings = false;
	}

	function startEdit(conn: Connector) {
		editingId = conn.id;
		editConnector = {
			name: conn.name,
			provider: conn.provider,
			base_url: conn.base_url,
			model_name: conn.model_name,
			api_key: conn.api_key
		};
		editTestResult = null;
	}

	function cancelEdit() {
		editingId = null;
		editTestResult = null;
	}

	async function handleEditTest() {
		editTesting = true;
		editTestResult = null;
		editTestResult = await testConnector(editConnector);
		editTesting = false;
	}

	async function handleUpdate() {
		if (!editingId) return;
		saving = true;
		await fetch(`/api/connectors/${editingId}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(editConnector)
		});
		await loadConnectors();
		editingId = null;
		editTestResult = null;
		saving = false;
	}

	async function handleActivate(id: string) {
		await fetch(`/api/connectors/activate/${id}`, { method: 'POST' });
		await loadConnectors();
	}

	async function handleDelete(id: string) {
		await fetch(`/api/connectors/${id}`, { method: 'DELETE' });
		if (editingId === id) cancelEdit();
		await loadConnectors();
	}

	const inputClass =
		'w-full bg-[var(--bg-field)] border border-[var(--border-base)] rounded-md px-3 py-2 text-sm text-[var(--fg-base)] placeholder-[var(--fg-disabled)] focus:outline-none focus:border-[var(--border-interactive)] focus:ring-1 focus:ring-[var(--border-interactive)] transition-colors';
</script>

{#if app.showSettings}
	<div class="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
		<div class="fixed inset-0 bg-[var(--bg-overlay)]" onclick={() => app.showSettings = false}></div>
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div
			class="relative bg-[var(--bg-subtle)] border border-[var(--border-base)] rounded-lg shadow-[0_4px_24px_rgba(0,0,0,0.4)] max-h-[85vh] overflow-y-auto w-[520px] z-10"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="flex items-center justify-between px-5 py-4 border-b border-[var(--border-base)]">
				<h2 class="text-sm font-medium text-[var(--fg-base)]">AI Connectors</h2>
				<button onclick={() => app.showSettings = false} class="p-1 text-[var(--fg-subtle)] hover:text-[var(--fg-base)] rounded transition-colors cursor-pointer">
					<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
				</button>
			</div>
			<div class="p-5 space-y-5">
				<div class="bg-[var(--bg-component)] border border-[var(--border-base)] rounded-lg p-4">
					<h3 class="text-xs font-medium text-[var(--fg-subtle)] uppercase tracking-wide mb-4">Add New Connector</h3>
					<div class="space-y-3">
						<input
							type="text"
							bind:value={newConnector.name}
							placeholder="Connector Name"
							class="w-full bg-[var(--bg-field)] border border-[var(--border-base)] rounded-md px-3 py-2 text-sm text-[var(--fg-base)] placeholder-[var(--fg-disabled)] focus:outline-none focus:border-[var(--border-interactive)] focus:ring-1 focus:ring-[var(--border-interactive)] transition-colors"
						/>
						<select
							bind:value={newConnector.provider}
							class="w-full bg-[var(--bg-field)] border border-[var(--border-base)] rounded-md px-3 py-2 text-sm text-[var(--fg-base)] focus:outline-none focus:border-[var(--border-interactive)] cursor-pointer"
						>
							<option value="openai">OpenAI Compatible</option>
							<option value="anthropic">Anthropic Claude</option>
							<option value="gemini">Google Gemini</option>
						</select>
						<input
							type="text"
							bind:value={newConnector.base_url}
							placeholder="Base URL"
							class="w-full bg-[var(--bg-field)] border border-[var(--border-base)] rounded-md px-3 py-2 text-sm text-[var(--fg-base)] placeholder-[var(--fg-disabled)] focus:outline-none focus:border-[var(--border-interactive)] focus:ring-1 focus:ring-[var(--border-interactive)] transition-colors"
						/>
						<input
							type="text"
							bind:value={newConnector.model_name}
							placeholder="Model Name"
							class="w-full bg-[var(--bg-field)] border border-[var(--border-base)] rounded-md px-3 py-2 text-sm text-[var(--fg-base)] placeholder-[var(--fg-disabled)] focus:outline-none focus:border-[var(--border-interactive)] focus:ring-1 focus:ring-[var(--border-interactive)] transition-colors"
						/>
						<input
							type="password"
							bind:value={newConnector.api_key}
							placeholder="API Key"
							class="w-full bg-[var(--bg-field)] border border-[var(--border-base)] rounded-md px-3 py-2 text-sm text-[var(--fg-base)] placeholder-[var(--fg-disabled)] focus:outline-none focus:border-[var(--border-interactive)] focus:ring-1 focus:ring-[var(--border-interactive)] transition-colors"
						/>
						<div class="flex gap-2 pt-1">
							<button
								onclick={handleTest}
								disabled={testingConnector}
								class="flex-1 py-2 bg-[var(--button-neutral)] hover:bg-[var(--button-neutral-hover)] disabled:opacity-50 border border-[var(--border-base)] rounded-md text-sm font-medium transition-colors cursor-pointer text-[var(--fg-base)]"
							>
								{#if testingConnector}Testing...{:else}Test Connection{/if}
							</button>
							<button
								onclick={handleSave}
								class="flex-1 py-2 bg-[var(--fg-interactive)] hover:opacity-90 rounded-md text-sm font-medium transition-colors cursor-pointer text-[var(--fg-on-color)]"
							>
								Add Connector
							</button>
						</div>
						{#if testResult}
							<div class="p-3 rounded-md text-xs border {testResult.success ? 'bg-[var(--tag-green-bg)] border-[var(--tag-green-border)] text-[var(--tag-green-text)]' : 'bg-[var(--tag-red-bg)] border-[var(--tag-red-border)] text-[var(--tag-red-text)]'}">
								{testResult.success ? 'Connection successful' : testResult.error}
							</div>
						{/if}
					</div>
				</div>

				<div class="space-y-2">
					{#if app.connectors.length > 0}
						<p class="text-xs font-medium text-[var(--fg-subtle)] uppercase tracking-wide">Configured Connectors</p>
					{/if}
					{#each app.connectors as conn (conn.id)}
						<div class="bg-[var(--bg-component)] border border-[var(--border-base)] rounded-lg p-3.5">
							{#if editingId === conn.id}
								<div class="space-y-3">
									<div class="flex items-center justify-between">
										<h4 class="text-xs font-medium text-[var(--fg-subtle)] uppercase tracking-wide">Edit Connector</h4>
									</div>
									<input type="text" bind:value={editConnector.name} placeholder="Connector Name" class={inputClass} />
									<select bind:value={editConnector.provider} class="{inputClass} cursor-pointer">
										<option value="openai">OpenAI Compatible</option>
										<option value="anthropic">Anthropic Claude</option>
										<option value="gemini">Google Gemini</option>
									</select>
									<input type="text" bind:value={editConnector.base_url} placeholder="Base URL" class={inputClass} />
									<input type="text" bind:value={editConnector.model_name} placeholder="Model Name" class={inputClass} />
									<input type="password" bind:value={editConnector.api_key} placeholder="API Key" class={inputClass} />
									<div class="flex gap-2 pt-1">
										<button
											onclick={handleEditTest}
											disabled={editTesting}
											class="flex-1 py-2 bg-[var(--button-neutral)] hover:bg-[var(--button-neutral-hover)] disabled:opacity-50 border border-[var(--border-base)] rounded-md text-sm font-medium transition-colors cursor-pointer text-[var(--fg-base)]"
										>
											{#if editTesting}Testing...{:else}Test{/if}
										</button>
										<button
											onclick={cancelEdit}
											class="flex-1 py-2 bg-[var(--button-neutral)] hover:bg-[var(--button-neutral-hover)] border border-[var(--border-base)] rounded-md text-sm font-medium transition-colors cursor-pointer text-[var(--fg-base)]"
										>
											Cancel
										</button>
										<button
											onclick={handleUpdate}
											disabled={saving}
											class="flex-1 py-2 bg-[var(--fg-interactive)] hover:opacity-90 disabled:opacity-50 rounded-md text-sm font-medium transition-colors cursor-pointer text-[var(--fg-on-color)]"
										>
											{#if saving}Saving...{:else}Save{/if}
										</button>
									</div>
									{#if editTestResult}
										<div class="p-3 rounded-md text-xs border {editTestResult.success ? 'bg-[var(--tag-green-bg)] border-[var(--tag-green-border)] text-[var(--tag-green-text)]' : 'bg-[var(--tag-red-bg)] border-[var(--tag-red-border)] text-[var(--tag-red-text)]'}">
											{editTestResult.success ? 'Connection successful' : editTestResult.error}
										</div>
									{/if}
								</div>
							{:else}
								<div class="flex items-start justify-between gap-3">
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2 mb-0.5">
											<span class="text-sm font-medium text-[var(--fg-base)] truncate">{conn.name}</span>
											{#if conn.is_active}
												<span class="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-[var(--tag-green-bg)] text-[var(--tag-green-text)] border border-[var(--tag-green-border)]">Active</span>
											{/if}
										</div>
										<div class="text-xs text-[var(--fg-muted)]">{conn.provider} &bull; {conn.model_name}</div>
										<div class="text-xs text-[var(--fg-muted)] truncate mt-0.5">{conn.base_url}</div>
									</div>
									<div class="flex items-center gap-1.5 shrink-0">
										{#if !conn.is_active}
											<button onclick={() => handleActivate(conn.id)} class="px-2 py-1 text-xs bg-[var(--button-neutral)] hover:bg-[var(--button-neutral-hover)] border border-[var(--border-base)] rounded-md transition-colors cursor-pointer text-[var(--fg-base)]">Activate</button>
										{/if}
										<button onclick={() => startEdit(conn)} class="px-2 py-1 text-xs bg-[var(--button-neutral)] hover:bg-[var(--button-neutral-hover)] border border-[var(--border-base)] rounded-md transition-colors cursor-pointer text-[var(--fg-base)]">Edit</button>
										<button onclick={() => handleDelete(conn.id)} class="px-2 py-1 text-xs text-[var(--fg-error)] hover:bg-[var(--tag-red-bg)] rounded-md transition-colors cursor-pointer">Delete</button>
									</div>
								</div>
							{/if}
						</div>
					{/each}
					{#if app.connectors.length === 0}
						<div class="text-center py-4">
							<p class="text-xs text-[var(--fg-muted)]">No connectors configured</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
