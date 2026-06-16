import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

/** Returns a 403 Response if the caller is not an admin, else null. */
export function notAdmin(locals: RequestEvent['locals']): Response | null {
	if (locals.user?.role !== 'admin') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}
	return null;
}
