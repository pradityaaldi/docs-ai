import type { RequestEvent } from '@sveltejs/kit';

export async function handle({ event, resolve }: { event: RequestEvent; resolve: (event: RequestEvent) => Promise<Response> }) {
	return resolve(event);
}