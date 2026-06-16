import { db, aiConfig } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import type { AIConnector } from '$lib/server/ai';

/**
 * Load the single active admin-configured AI connection and adapt it to the
 * shape the ai.ts streaming helpers expect. Returns null if none active.
 */
export async function getActiveAIConnector(): Promise<AIConnector | null> {
	const [cfg] = await db.select().from(aiConfig).where(eq(aiConfig.isActive, true)).limit(1);
	if (!cfg) return null;
	return {
		id: cfg.id,
		name: cfg.provider,
		provider: cfg.provider,
		base_url: cfg.baseUrl,
		model_name: cfg.model,
		api_key: cfg.apiKey,
		is_active: 1
	};
}
