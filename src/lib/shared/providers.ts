// Isomorphic AI provider catalog — single source of truth for provider ids,
// display labels, selectable models, and default base URLs. Used by the admin
// config UI (client) and the ai-config API endpoints (server). Keep the schema
// enum in db/schema.ts in sync with PROVIDER_IDS when adding a provider.

export type AIProviderId = 'openai' | 'anthropic' | 'gemini' | 'minimax';

export const PROVIDER_IDS: AIProviderId[] = ['openai', 'anthropic', 'gemini', 'minimax'];

export const PROVIDER_LABELS: Record<AIProviderId, string> = {
	openai: 'OpenAI',
	anthropic: 'Anthropic',
	gemini: 'Gemini',
	minimax: 'MiniMax'
};

// Selectable models per provider (admin picks instead of typing).
export const PROVIDER_MODELS: Record<AIProviderId, string[]> = {
	openai: ['gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-5', 'gpt-5-mini'],
	anthropic: ['claude-opus-4-1', 'claude-sonnet-4-5', 'claude-3-7-sonnet', 'claude-3-5-haiku'],
	gemini: ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3-flash', 'gemini-3.5-flash', 'gemini-3.1-pro'],
	// MiniMax is OpenAI-compatible (/chat/completions, Bearer auth).
	minimax: [
		'MiniMax-M3',
		'MiniMax-M2.7',
		'MiniMax-M2.7-highspeed',
		'MiniMax-M2.5',
		'MiniMax-M2.5-highspeed',
		'MiniMax-M2.1',
		'MiniMax-M2.1-highspeed',
		'MiniMax-M2'
	]
};

export const DEFAULT_BASE: Record<AIProviderId, string> = {
	openai: 'https://api.openai.com/v1',
	anthropic: 'https://api.anthropic.com',
	gemini: 'https://generativelanguage.googleapis.com',
	// International platform (platform.minimax.io). China mainland keys instead
	// use https://api.minimaxi.com/v1 — keys are region-bound, set base to match.
	minimax: 'https://api.minimax.io/v1'
};
