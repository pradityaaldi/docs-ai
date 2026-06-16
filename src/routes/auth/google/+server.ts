import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { randomBytes } from 'node:crypto';

export const GET: RequestHandler = async (event) => {
	const clientId = env.GOOGLE_CLIENT_ID;
	const redirectUri = env.GOOGLE_REDIRECT_URI || `${env.APP_URL || 'http://localhost:5173'}/auth/google/callback`;

	if (!clientId) {
		// creds nyusul — fail gracefully
		throw redirect(302, '/auth/login?error=google_unconfigured');
	}

	const state = randomBytes(16).toString('hex');
	event.cookies.set('google_oauth_state', state, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !import.meta.env.DEV,
		maxAge: 60 * 10
	});

	const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
	url.searchParams.set('client_id', clientId);
	url.searchParams.set('redirect_uri', redirectUri);
	url.searchParams.set('response_type', 'code');
	url.searchParams.set('scope', 'openid email profile');
	url.searchParams.set('state', state);
	url.searchParams.set('access_type', 'offline');
	url.searchParams.set('prompt', 'select_account');

	throw redirect(302, url.toString());
};
