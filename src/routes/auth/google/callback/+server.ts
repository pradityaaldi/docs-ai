import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { db, users, oauthAccounts } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';
import { createSession, setSessionCookie } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
	const clientId = env.GOOGLE_CLIENT_ID;
	const clientSecret = env.GOOGLE_CLIENT_SECRET;
	const redirectUri = env.GOOGLE_REDIRECT_URI || `${env.APP_URL || 'http://localhost:5173'}/auth/google/callback`;

	if (!clientId || !clientSecret) {
		throw redirect(302, '/auth/login?error=google_unconfigured');
	}

	const code = event.url.searchParams.get('code');
	const state = event.url.searchParams.get('state');
	const savedState = event.cookies.get('google_oauth_state');
	event.cookies.delete('google_oauth_state', { path: '/' });

	if (!code || !state || state !== savedState) {
		throw redirect(302, '/auth/login?error=google_state');
	}

	// exchange code for tokens
	const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			code,
			client_id: clientId,
			client_secret: clientSecret,
			redirect_uri: redirectUri,
			grant_type: 'authorization_code'
		})
	});
	if (!tokenRes.ok) {
		console.error('[google] token exchange failed', await tokenRes.text());
		throw redirect(302, '/auth/login?error=google_token');
	}
	const tokens = await tokenRes.json();

	// fetch profile
	const profRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
		headers: { Authorization: `Bearer ${tokens.access_token}` }
	});
	if (!profRes.ok) {
		throw redirect(302, '/auth/login?error=google_profile');
	}
	const profile = await profRes.json();
	const providerAccountId = profile.sub as string;
	const email = (profile.email as string)?.toLowerCase();
	const name = (profile.name as string) || '';

	if (!providerAccountId || !email) {
		throw redirect(302, '/auth/login?error=google_profile');
	}

	// find existing oauth account
	let userId: string;
	const [existingOauth] = await db
		.select()
		.from(oauthAccounts)
		.where(and(eq(oauthAccounts.provider, 'google'), eq(oauthAccounts.providerAccountId, providerAccountId)));

	if (existingOauth) {
		userId = existingOauth.userId;
	} else {
		// link to existing user by email, or create new
		const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
		if (existingUser) {
			userId = existingUser.id;
			await db.update(users).set({ emailVerified: true }).where(eq(users.id, userId));
		} else {
			const isAdmin = env.ADMIN_EMAIL && email === env.ADMIN_EMAIL.toLowerCase();
			const [newUser] = await db
				.insert(users)
				.values({ email, name, emailVerified: true, role: isAdmin ? 'admin' : 'user' })
				.returning({ id: users.id });
			userId = newUser.id;
		}
		await db.insert(oauthAccounts).values({ userId, provider: 'google', providerAccountId });
	}

	const session = await createSession(userId);
	setSessionCookie(event, session.id, session.expiresAt);

	const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
	throw redirect(302, u?.role === 'admin' ? '/manage' : '/app');
};
