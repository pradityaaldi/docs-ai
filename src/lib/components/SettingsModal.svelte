<script lang="ts">
	import { app } from '$lib/stores/app.svelte';
	import { loadConnectors } from '$lib/actions';

	let newConnector = $state({ name: '', provider: 'openai', base_url: '', model_name: '', api_key: '' });
	let testingConnector = $state(false);
	let testResult = $state<{ success: boolean; error?: string } | null>(null);

	async function handleTest() {
		testingConnector = true;
		testResult = null;
		try {
			const res = await fetch('/api/connectors/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					provider: newConnector.provider,
					base_url: newConnector.base_url,
					model_name: newConnector.model_name,
					api_key: newConnector.api_key
				})
			});
			testResult = await res.json();
		} catch (e) {
			testResult = { success: false, error: (e as Error).message };
		} finally {
			testingConnector = false;
		}
	}

	async function handleSave() {
		await fetch('/api/connectors', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(newConnector)
		});
		await loadConnectors();
		newConnector = { name: '', provider: 'openai', base_url: '', model_name: '', api_key: '' };
		app.showSettings = false;
	}

	async function handleActivate(id: string) {
		await fetch(`/api/connectors/activate/${id}`, { method: 'POST' });
		await loadConnectors();
	}

	async function handleDelete(id: string) {
		await fetch(`/api/connectors/${id}`, { method: 'DELETE' });
		await loadConnectors();
	}
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
									<button onclick={() => handleDelete(conn.id)} class="px-2 py-1 text-xs text-[var(--fg-error)] hover:bg-[var(--tag-red-bg)] rounded-md transition-colors cursor-pointer">Delete</button>
								</div>
							</div>
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
