import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db, users, emailVerificationTokens } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { createSession, setSessionCookie } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
	const token = event.url.searchParams.get('token');
	if (!token) return { status: 'error' as const, message: 'Token tidak ada' };

	const [row] = await db
		.select()
		.from(emailVerificationTokens)
		.where(eq(emailVerificationTokens.token, token));

	if (!row || row.expiresAt.getTime() < Date.now()) {
		return { status: 'error' as const, message: 'Token kadaluarsa atau tidak valid' };
	}

	await db.update(users).set({ emailVerified: true }).where(eq(users.id, row.userId));
	await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, row.userId));

	// auto-login then go to dashboard
	const session = await createSession(row.userId);
	setSessionCookie(event, session.id, session.expiresAt);

	throw redirect(303, '/');
};
