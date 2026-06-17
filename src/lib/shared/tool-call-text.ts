// Some models (notably MiniMax-M3) intermittently emit tool calls as plain
// text content in the shape `{"tool_calls":[{"type":"tool_call","name":...,
// "arguments":{...}}]}` instead of via the native tool_calls field — especially
// once a prior turn with that shape leaks into history and trains the pattern.
// These helpers detect, extract, and strip such blocks so they execute as real
// tool calls and never reach the user or the saved transcript.

export const TOOL_CALLS_MARKER = '{"tool_calls"';

export interface ParsedTextToolCall {
	name: string;
	arguments: Record<string, unknown>;
}

// Find the end (exclusive) of a balanced `{...}` starting at `start`, honoring
// JSON string literals/escapes. Returns -1 if never closed (truncated stream).
function matchBrace(s: string, start: number): number {
	let depth = 0;
	let inStr = false;
	let esc = false;
	for (let i = start; i < s.length; i++) {
		const c = s[i];
		if (inStr) {
			if (esc) esc = false;
			else if (c === '\\') esc = true;
			else if (c === '"') inStr = false;
			continue;
		}
		if (c === '"') inStr = true;
		else if (c === '{') depth++;
		else if (c === '}') {
			depth--;
			if (depth === 0) return i + 1;
		}
	}
	return -1;
}

/**
 * Split out every `{"tool_calls":…}` JSON object embedded in model text.
 * Returns the visible text (with those blocks removed, trimmed) and the raw
 * JSON blocks. An unterminated trailing block is dropped from the text too.
 */
export function splitToolCallJson(text: string): { text: string; jsonBlocks: string[] } {
	if (!text || !text.includes(TOOL_CALLS_MARKER)) return { text, jsonBlocks: [] };
	let out = '';
	let rest = text;
	const jsonBlocks: string[] = [];
	while (rest) {
		const idx = rest.indexOf(TOOL_CALLS_MARKER);
		if (idx === -1) { out += rest; break; }
		out += rest.slice(0, idx);
		const end = matchBrace(rest, idx);
		if (end === -1) { jsonBlocks.push(rest.slice(idx)); break; } // truncated → drop
		jsonBlocks.push(rest.slice(idx, end));
		rest = rest.slice(end);
	}
	return { text: out.trim(), jsonBlocks };
}

/** Parse one `{"tool_calls":[…]}` block into tool calls. Tolerates arguments
 *  given as an object (text form) or a JSON string (native form). */
export function parseToolCallsBlock(block: string): ParsedTextToolCall[] {
	let obj: any;
	try { obj = JSON.parse(block); } catch { return []; }
	const arr = Array.isArray(obj?.tool_calls) ? obj.tool_calls : [];
	const calls: ParsedTextToolCall[] = [];
	for (const tc of arr) {
		const name = tc?.name || tc?.function?.name;
		if (!name) continue;
		let rawArgs = tc?.arguments ?? tc?.function?.arguments ?? {};
		if (typeof rawArgs === 'string') {
			try { rawArgs = JSON.parse(rawArgs); } catch { rawArgs = {}; }
		}
		calls.push({ name, arguments: (rawArgs && typeof rawArgs === 'object') ? rawArgs : {} });
	}
	return calls;
}

/** Convenience: strip tool-call JSON from text meant for display/history. */
export function stripToolCallJson(text: string): string {
	return splitToolCallJson(text).text;
}
