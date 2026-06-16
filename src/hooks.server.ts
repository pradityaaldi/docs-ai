import { json, type Handle } from '@sveltejs/kit';
import { SESSION_COOKIE, validateSession } from '$lib/server/auth';

// API paths that don't require an authenticated user.
const PUBLIC_API = ['/api/auth/', '/api/billing/webhook'];

export const handle: Handle = async ({ event, resolve }) => {
	const sessionId = event.cookies.get(SESSION_COOKIE) ?? null;
	event.locals.sessionId = sessionId;
	event.locals.user = sessionId ? await validateSession(sessionId) : null;

	const { pathname } = event.url;
	if (pathname.startsWith('/api/') && !PUBLIC_API.some((p) => pathname.startsWith(p))) {
		if (!event.locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}
	}

	return resolve(event);
};
