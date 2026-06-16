import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

const connectionString = env.DATABASE_URL || 'postgres://postgres@localhost:5432/paperio';

// Reuse a single client across HMR reloads in dev.
const globalForDb = globalThis as unknown as { __pgClient?: ReturnType<typeof postgres> };

const client = globalForDb.__pgClient ?? postgres(connectionString, { max: 10 });
if (import.meta.env?.DEV) globalForDb.__pgClient = client;

export const db = drizzle(client, { schema });
export { schema };
export * from './schema';
