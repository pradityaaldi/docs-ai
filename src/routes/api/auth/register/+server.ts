import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, users, emailVerificationTokens } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { hashPassword, generateToken } from '$lib/server/auth';
import { sendEmail, verifyEmailTemplate } from '$lib/server/email';
import { env } from '$env/dynamic/private';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: RequestHandler = async ({ request }) => {
	const { email, password, name } = await request.json();

	if (!email || !EMAIL_RE.test(email)) {
		return json({ error: 'Email tidak valid' }, { status: 400 });
	}
	if (!password || password.length < 8) {
		return json({ error: 'Password minimal 8 karakter' }, { status: 400 });
	}

	const normEmail = email.trim().toLowerCase();
	const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, normEmail));
	if (existing) {
		return json({ error: 'Email sudah terdaftar' }, { status: 409 });
	}

	const isAdmin = env.ADMIN_EMAIL && normEmail === env.ADMIN_EMAIL.toLowerCase();
	const passwordHash = await hashPassword(password);

	const [user] = await db
		.insert(users)
		.values({
			email: normEmail,
			passwordHash,
			name: (name || '').trim(),
			role: isAdmin ? 'admin' : 'user',
			emailVerified: false
		})
		.returning();

	const token = generateToken();
	await db.insert(emailVerificationTokens).values({
		userId: user.id,
		token,
		expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24) // 24h
	});

	const tpl = verifyEmailTemplate(token);
	await sendEmail({ to: normEmail, ...tpl });

	return json({ ok: true, needVerify: true });
};
