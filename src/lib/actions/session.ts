import { goto } from '$app/navigation';
import { app } from '$lib/stores/app.svelte';
import { confirmAction } from '$lib/stores/confirm.svelte';

export async function logout() {
	const ok = await confirmAction({
		title: 'Keluar',
		message: 'Yakin ingin keluar dari akun ini?',
		confirmText: 'Keluar'
	});
	if (!ok) return;
	await fetch('/api/auth/logout', { method: 'POST' });
	app.currentUser = null;
	goto('/auth/login');
}

export async function loadAIStatus() {
	try {
		const res = await fetch('/api/ai-status');
		const data = await res.json();
		app.aiReady = !!data.ready;
		app.aiProvider = data.provider || '';
	} catch {
		app.aiReady = false;
		app.aiProvider = '';
	}
}
