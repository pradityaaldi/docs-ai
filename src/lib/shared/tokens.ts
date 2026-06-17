// Lightweight, provider-agnostic token estimation. Not exact (no tokenizer),
// but good enough to monitor conversation context and trim history to a budget.
// Heuristic: ~4 characters per token, the common rough ratio for mixed text.

export const CHARS_PER_TOKEN = 4;

/** Soft context window used by the UI meter (most chat models are >= 128k). */
export const CONTEXT_WINDOW = 128_000;

/** Tokens reserved for the model's reply when trimming history. */
export const REPLY_RESERVE = 8_000;

export function estimateTokens(text: string | null | undefined): number {
	if (!text) return 0;
	return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export interface TokenMessage {
	role: string;
	content: string;
}

/** Total estimated tokens for a set of messages (+ small per-message overhead). */
export function messagesTokens(messages: TokenMessage[]): number {
	let n = 0;
	for (const m of messages) n += estimateTokens(m.content) + 4;
	return n;
}

/**
 * Keep the most recent messages that fit within maxTokens (oldest dropped
 * first). Returns a new array; never reorders. Always keeps the last message.
 */
export function trimHistoryToBudget<T extends TokenMessage>(messages: T[], maxTokens: number): T[] {
	if (messages.length === 0) return messages;
	const kept: T[] = [];
	let used = 0;
	for (let i = messages.length - 1; i >= 0; i--) {
		const cost = estimateTokens(messages[i].content) + 4;
		if (used + cost > maxTokens && kept.length > 0) break;
		kept.unshift(messages[i]);
		used += cost;
	}
	return kept;
}

/** Format a token count for display, e.g. 1234 → "1.2k". */
export function fmtTokens(n: number): string {
	if (n < 1000) return String(n);
	return (n / 1000).toFixed(n < 10_000 ? 1 : 0) + 'k';
}
