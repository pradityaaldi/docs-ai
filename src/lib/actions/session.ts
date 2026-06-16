import { goto } from '$app/navigation';
import { app } from '$lib/stores/app.svelte';

export async function logout() {
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
