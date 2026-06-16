import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, users } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { verifyPassword, createSession, setSessionCookie } from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
	const { email, password } = await event.request.json();
	if (!email || !password) {
		return json({ error: 'Email dan password wajib diisi' }, { status: 400 });
	}

	const normEmail = email.trim().toLowerCase();
	const [user] = await db.select().from(users).where(eq(users.email, normEmail));
	if (!user || !user.passwordHash) {
		return json({ error: 'Email atau password salah' }, { status: 401 });
	}

	const ok = await verifyPassword(password, user.passwordHash);
	if (!ok) {
		return json({ error: 'Email atau password salah' }, { status: 401 });
	}

	if (!user.emailVerified) {
		return json({ error: 'Email belum diverifikasi. Cek inbox kamu.', needVerify: true }, { status: 403 });
	}

	const session = await createSession(user.id);
	setSessionCookie(event, session.id, session.expiresAt);

	return json({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
};
