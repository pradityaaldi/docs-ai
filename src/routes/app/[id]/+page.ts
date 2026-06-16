import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const ssr = false;

// Load the project + its file tree before the component renders, so the workspace
// paints fully populated (no empty-shell flash). Reruns on `params.id` change.
export const load: PageLoad = async ({ params, fetch }) => {
	const [pRes, tRes] = await Promise.all([
		fetch(`/api/projects/${params.id}`),
		fetch(`/api/projects/${params.id}/tree`)
	]);

	// Missing / forbidden / deleted project: fall back to the list, same as before.
	if (!pRes.ok || !tRes.ok) throw redirect(307, '/app');

	const project = await pRes.json();
	const tree = await tRes.json();

	return {
		project,
		tree: tree.tree ?? [],
		rootDocuments: tree.rootDocuments ?? []
	};
};
