import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { invalidateSession, clearSessionCookie } from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
	if (event.locals.sessionId) {
		await invalidateSession(event.locals.sessionId);
	}
	clearSessionCookie(event);
	return json({ ok: true });
};
