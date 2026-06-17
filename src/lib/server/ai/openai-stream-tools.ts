import type { ToolCall, ToolCallResponse } from './types';
import { makeReasoningStripper } from './reasoning';

// Accumulator for one streamed OpenAI tool_call (arguments arrive as fragments).
interface ToolAcc {
	name: string;
	args: string;
}

// Read with an idle watchdog: reasoning models stream tokens continuously, so a
// long gap means the upstream stalled — force-close instead of hanging forever.
function readWithIdle(
	reader: ReadableStreamDefaultReader<Uint8Array>,
	idleMs: number
): Promise<{ done: boolean; value?: Uint8Array; timedOut?: boolean }> {
	return new Promise((resolve, reject) => {
		let settled = false;
		const t = setTimeout(() => {
			if (settled) return;
			settled = true;
			console.warn(`[TOOLS] stream idle timeout after ${idleMs}ms — forcing close`);
			resolve({ done: true, timedOut: true });
		}, idleMs);
		reader.read().then(
			(r) => { if (settled) return; settled = true; clearTimeout(t); resolve(r); },
			(e) => { if (settled) return; settled = true; clearTimeout(t); reject(e); }
		);
	});
}

/**
 * Consume an OpenAI-compatible (incl. MiniMax) chat-completions SSE stream.
 * Streaming is what keeps the connection alive through MiniMax-M3's long
 * `<think>` reasoning — the non-streaming endpoint caps such requests at ~30s
 * and returns a truncated, empty-after-strip body.
 *
 * Visible content deltas are stripped of reasoning and pushed live via `emit`.
 * tool_call fragments are accumulated by index, then parsed into ToolCall[].
 */
export async function consumeOpenAIToolStream(
	body: ReadableStream<Uint8Array>,
	emit: (text: string) => void,
	signal?: AbortSignal,
	idleMs = 90000
): Promise<ToolCallResponse> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	const strip = makeReasoningStripper();

	const toolAccs = new Map<number, ToolAcc>();
	let fullText = '';
	let finishReason = 'stop';
	let buffer = '';

	const handleData = (data: string) => {
		let parsed: any;
		try { parsed = JSON.parse(data); } catch { return; }
		const choice = parsed.choices?.[0];
		if (!choice) return;
		const delta = choice.delta || {};

		if (typeof delta.content === 'string' && delta.content) {
			const out = strip(delta.content);
			if (out) { fullText += out; emit(out); }
		}

		if (Array.isArray(delta.tool_calls)) {
			for (const tc of delta.tool_calls) {
				const idx = tc.index ?? 0;
				const acc = toolAccs.get(idx) || { name: '', args: '' };
				if (tc.function?.name) acc.name = tc.function.name;
				if (typeof tc.function?.arguments === 'string') acc.args += tc.function.arguments;
				toolAccs.set(idx, acc);
			}
		}

		if (choice.finish_reason) finishReason = choice.finish_reason;
	};

	try {
		while (true) {
			if (signal?.aborted) { reader.cancel('aborted').catch(() => {}); break; }
			const { done, value, timedOut } = await readWithIdle(reader, idleMs);
			if (done) {
				if (timedOut) reader.cancel('idle timeout').catch(() => {});
				break;
			}
			buffer += decoder.decode(value, { stream: true });
			let nl: number;
			while ((nl = buffer.indexOf('\n')) !== -1) {
				const line = buffer.slice(0, nl).trim();
				buffer = buffer.slice(nl + 1);
				if (!line || !line.startsWith('data:')) continue;
				const data = line.slice(line.indexOf(':') + 1).trim();
				if (data === '[DONE]') { buffer = ''; reader.cancel('done').catch(() => {}); break; }
				handleData(data);
			}
		}
	} finally {
		reader.releaseLock?.();
	}

	const toolCalls: ToolCall[] = [];
	for (const acc of toolAccs.values()) {
		if (!acc.name) continue;
		let args: Record<string, unknown> = {};
		try { args = acc.args ? JSON.parse(acc.args) : {}; } catch { args = {}; }
		toolCalls.push({ name: acc.name, arguments: args });
	}

	return {
		text: fullText || null,
		toolCalls: toolCalls.length ? toolCalls : null,
		finishReason
	};
}
