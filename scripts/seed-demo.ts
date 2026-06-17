/**
 * Demo / staging seeder. Idempotent — safe to run on every deploy.
 *
 * Creates an admin + a demo user (with an active subscription) and, when
 * MINIMAX_API_KEY is set, configures + activates a MiniMax M3 ai_config so the
 * cloud demo can generate immediately. Run AFTER `db:seed` (needs plans).
 *
 * Env:
 *   DATABASE_URL        required
 *   MINIMAX_API_KEY     optional — sets/activates the MiniMax M3 connector
 *   ADMIN_EMAIL/ADMIN_PASSWORD   default admin@paperio.test / Admin#12345
 *   DEMO_EMAIL/DEMO_PASSWORD     default demo@paperio.test / Demo#12345
 */
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { and, eq } from 'drizzle-orm';
import { randomBytes, scrypt as _scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import * as schema from '../src/lib/server/db/schema';

const scrypt = promisify(_scrypt);

// Must match src/lib/server/auth.ts hashPassword format: `${saltHex}:${keyHex}`.
async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16).toString('hex');
	const derived = (await scrypt(password, salt, 64)) as Buffer;
	return `${salt}:${derived.toString('hex')}`;
}

const url = process.env.DATABASE_URL || 'postgres://postgres@localhost:5432/paperio';
const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@paperio.test').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin#12345';
const DEMO_EMAIL = (process.env.DEMO_EMAIL || 'demo@paperio.test').toLowerCase();
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo#12345';

async function upsertUser(email: string, password: string, name: string, role: 'user' | 'admin') {
	const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, email));
	const passwordHash = await hashPassword(password);
	if (existing) {
		await db.update(schema.users)
			.set({ passwordHash, name, role, emailVerified: true })
			.where(eq(schema.users.id, existing.id));
		return existing.id;
	}
	const [created] = await db.insert(schema.users)
		.values({ email, passwordHash, name, role, emailVerified: true })
		.returning({ id: schema.users.id });
	return created.id;
}

async function ensureActiveSubscription(userId: string) {
	const [existing] = await db.select().from(schema.subscriptions)
		.where(and(eq(schema.subscriptions.userId, userId), eq(schema.subscriptions.status, 'active')));
	if (existing) return;
	const plans = await db.select().from(schema.plans).where(eq(schema.plans.isActive, true));
	const plan = plans.find((p) => p.name === 'Pro') || plans.find((p) => p.name === 'Basic') || plans[0];
	const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
	await db.insert(schema.subscriptions).values({
		userId,
		planId: plan?.id ?? null,
		status: 'active',
		expiresAt
	});
}

async function ensureMinimaxConfig(adminId: string) {
	const key = process.env.MINIMAX_API_KEY;
	if (!key) {
		console.log('[seed-demo] MINIMAX_API_KEY not set — skipping ai_config');
		return;
	}
	const base = process.env.AI_BASE || 'https://api.minimax.io/v1';
	const model = process.env.AI_MODEL || 'MiniMax-M3';
	// single active connector at a time
	await db.update(schema.aiConfig).set({ isActive: false });
	const [existing] = await db.select().from(schema.aiConfig)
		.where(and(eq(schema.aiConfig.provider, 'minimax'), eq(schema.aiConfig.model, model)));
	if (existing) {
		await db.update(schema.aiConfig)
			.set({ apiKey: key, baseUrl: base, isActive: true, updatedBy: adminId, updatedAt: new Date() })
			.where(eq(schema.aiConfig.id, existing.id));
	} else {
		await db.insert(schema.aiConfig)
			.values({ provider: 'minimax', model, baseUrl: base, apiKey: key, isActive: true, updatedBy: adminId });
	}
	console.log(`[seed-demo] ai_config active: minimax / ${model}`);
}

async function main() {
	const adminId = await upsertUser(ADMIN_EMAIL, ADMIN_PASSWORD, 'Admin Demo', 'admin');
	const demoId = await upsertUser(DEMO_EMAIL, DEMO_PASSWORD, 'Demo User', 'user');
	await ensureActiveSubscription(demoId);
	await ensureMinimaxConfig(adminId);
	console.log(`[seed-demo] admin=${ADMIN_EMAIL} demo=${DEMO_EMAIL} (active sub) done`);
	await client.end();
}

main().catch((e) => {
	console.error('[seed-demo] failed:', e);
	process.exit(1);
});
