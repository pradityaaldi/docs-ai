import { randomBytes, scrypt as _scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { db, users, sessions } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import type { User } from '$lib/server/db/schema';

const scrypt = promisify(_scrypt);

export const SESSION_COOKIE = 'paperio_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

// ── Password hashing (scrypt, salt:hash hex) ──

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16).toString('hex');
	const derived = (await scrypt(password, salt, 64)) as Buffer;
	return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
	if (!stored || !stored.includes(':')) return false;
	const [salt, key] = stored.split(':');
	const keyBuf = Buffer.from(key, 'hex');
	const derived = (await scrypt(password, salt, 64)) as Buffer;
	if (keyBuf.length !== derived.length) return false;
	return timingSafeEqual(keyBuf, derived);
}

// ── Random tokens (verify / reset) ──

export function generateToken(): string {
	return randomBytes(32).toString('hex');
}

// ── Sessions ──

export async function createSession(userId: string): Promise<{ id: string; expiresAt: Date }> {
	const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
	const [s] = await db.insert(sessions).values({ userId, expiresAt }).returning();
	return { id: s.id, expiresAt: s.expiresAt };
}

export type SessionUser = Pick<User, 'id' | 'email' | 'name' | 'role' | 'emailVerified'>;

export async function validateSession(sessionId: string): Promise<SessionUser | null> {
	const [row] = await db
		.select({
			session: sessions,
			user: {
				id: users.id,
				email: users.email,
				name: users.name,
				role: users.role,
				emailVerified: users.emailVerified
			}
		})
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(eq(sessions.id, sessionId))
		.limit(1);

	if (!row) return null;
	if (row.session.expiresAt.getTime() < Date.now()) {
		await db.delete(sessions).where(eq(sessions.id, sessionId));
		return null;
	}
	return row.user;
}

export async function invalidateSession(sessionId: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.id, sessionId));
}

// ── Cookie helpers ──

export function setSessionCookie(event: RequestEvent, sessionId: string, expiresAt: Date) {
	event.cookies.set(SESSION_COOKIE, sessionId, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !import.meta.env.DEV,
		expires: expiresAt
	});
}

export function clearSessionCookie(event: RequestEvent) {
	event.cookies.delete(SESSION_COOKIE, { path: '/' });
}
