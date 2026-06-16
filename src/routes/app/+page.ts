import type { PageLoad } from './$types';

export const ssr = false;

// Load the project list before the page renders so the grid paints populated.
// Avoids the "Memuat…" loading flash on back-navigation from a workspace.
export const load: PageLoad = async ({ fetch }) => {
	const res = await fetch('/api/projects');
	const projects = res.ok ? await res.json() : [];
	return { projects };
};
