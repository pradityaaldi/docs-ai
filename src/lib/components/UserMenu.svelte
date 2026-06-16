<script lang="ts">
	import { app } from '$lib/stores/app.svelte';
	import { logout } from '$lib/actions';
	import { UserIcon, LogOutIcon } from '$lib/components/ui/icons';

	let name = $derived(app.currentUser?.name?.trim() || '');
	let email = $derived(app.currentUser?.email || '');
	let initial = $derived((name || email || '?').charAt(0).toUpperCase());
</script>

<div class="group relative">
	<button
		type="button"
		class="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--fg-interactive)] text-sm font-semibold text-[var(--bg-base)] transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-interactive)]"
		aria-label="Menu akun"
		aria-haspopup="menu"
	>
		{initial}
	</button>

	<!-- pt-2 = invisible bridge so hover survives the gap to the panel -->
	<div
		class="absolute right-0 top-full z-50 hidden min-w-56 pt-2 group-hover:block group-focus-within:block"
		role="menu"
	>
		<div class="overflow-hidden rounded-lg border border-[var(--border-base)] bg-[var(--bg-component)] shadow-lg">
			<div class="border-b border-[var(--border-base)] px-4 py-3">
				<div class="truncate text-sm font-medium">{name || 'Pengguna'}</div>
				<div class="truncate text-xs text-[var(--fg-muted)]">{email}</div>
			</div>
			<a
				href="/profile"
				role="menuitem"
				class="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-[var(--bg-base-hover)]"
			>
				<UserIcon size={16} />
				Profil
			</a>
			<button
				type="button"
				role="menuitem"
				onclick={logout}
				class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-[var(--fg-error)] hover:bg-[var(--bg-base-hover)]"
			>
				<LogOutIcon size={16} />
				Keluar
			</button>
		</div>
	</div>
</div>
