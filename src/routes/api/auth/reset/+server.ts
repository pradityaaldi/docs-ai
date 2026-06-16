import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, users, passwordResetTokens } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { hashPassword } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request }) => {
	const { token, password } = await request.json();
	if (!token) return json({ error: 'Token tidak valid' }, { status: 400 });
	if (!password || password.length < 8) {
		return json({ error: 'Password minimal 8 karakter' }, { status: 400 });
	}

	const [row] = await db
		.select()
		.from(passwordResetTokens)
		.where(eq(passwordResetTokens.token, token));

	if (!row || row.used || row.expiresAt.getTime() < Date.now()) {
		return json({ error: 'Token kadaluarsa atau sudah dipakai' }, { status: 400 });
	}

	const passwordHash = await hashPassword(password);
	await db.update(users).set({ passwordHash }).where(eq(users.id, row.userId));
	await db.update(passwordResetTokens).set({ used: true }).where(eq(passwordResetTokens.id, row.id));

	return json({ ok: true });
};
