// Reasoning models (e.g. MiniMax M-series) prepend a <think>…</think> block
// to message.content instead of exposing a separate reasoning_content field.
// That text must never reach generated documents or JSON parsers, so we strip
// it at the AI boundary. No-op for non-reasoning providers (no tags present).

const THINK_BLOCK = /<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi;
const OPEN_THINK = /<think(?:ing)?>/i;

/**
 * Remove reasoning blocks from a complete model response. Handles:
 *  - one or more well-formed <think>…</think> blocks
 *  - an unterminated <think>… (response truncated mid-reasoning) → drop to end
 */
export function stripReasoning(text: string | null | undefined): string {
	if (!text) return '';
	let out = text.replace(THINK_BLOCK, '');
	const open = out.search(OPEN_THINK);
	if (open !== -1) out = out.slice(0, open);
	return out.trim();
}

/**
 * Stateful stripper for streamed deltas. Suppresses a leading reasoning block
 * spanning multiple chunks; once the block closes (or it's clear none exists),
 * passes everything through verbatim. Returns the text to emit for each chunk.
 */
export function makeReasoningStripper(): (chunk: string) => string {
	let buffer = '';
	let mode: 'unknown' | 'thinking' | 'passthrough' = 'unknown';

	return (chunk: string): string => {
		if (mode === 'passthrough') return chunk;
		buffer += chunk;

		if (mode === 'unknown') {
			const trimmed = buffer.replace(/^\s+/, '');
			if (trimmed === '') return ''; // only whitespace so far, keep waiting
			if (OPEN_THINK.test(trimmed.slice(0, 9))) {
				mode = 'thinking';
			} else if (trimmed.length >= 9 || !'<think'.startsWith(trimmed.slice(0, Math.min(6, trimmed.length)))) {
				// definitely not a reasoning block → flush buffered text
				mode = 'passthrough';
				const emit = buffer;
				buffer = '';
				return emit;
			} else {
				return ''; // ambiguous prefix (e.g. "<th"), keep buffering
			}
		}

		if (mode === 'thinking') {
			const close = buffer.search(/<\/think(?:ing)?>/i);
			if (close === -1) return ''; // still inside reasoning
			mode = 'passthrough';
			const after = buffer.slice(close).replace(/^<\/think(?:ing)?>/i, '');
			buffer = '';
			return after.replace(/^\s+/, '');
		}

		return '';
	};
}

/**
 * Wrap a Uint8Array text stream so a leading reasoning block is stripped on the
 * fly. Passthrough for providers that don't emit reasoning tags.
 */
export function stripReasoningStream(input: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
	const decoder = new TextDecoder();
	const encoder = new TextEncoder();
	const strip = makeReasoningStripper();
	const transform = new TransformStream<Uint8Array, Uint8Array>({
		transform(chunk, controller) {
			const out = strip(decoder.decode(chunk, { stream: true }));
			if (out) controller.enqueue(encoder.encode(out));
		}
	});
	return input.pipeThrough(transform);
}
