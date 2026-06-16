import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, users, passwordResetTokens } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { generateToken } from '$lib/server/auth';
import { sendEmail, resetPasswordTemplate } from '$lib/server/email';

export const POST: RequestHandler = async ({ request }) => {
	const { email } = await request.json();
	const normEmail = (email || '').trim().toLowerCase();

	// Always respond ok (don't leak which emails exist)
	if (!normEmail) return json({ ok: true });

	const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, normEmail));
	if (user) {
		const token = generateToken();
		await db.insert(passwordResetTokens).values({
			userId: user.id,
			token,
			expiresAt: new Date(Date.now() + 1000 * 60 * 60) // 1h
		});
		const tpl = resetPasswordTemplate(token);
		await sendEmail({ to: normEmail, ...tpl });
	}

	return json({ ok: true });
};
