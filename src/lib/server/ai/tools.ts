import type { AIConnector, ChatMessage, ToolCall, ToolCallResponse, ToolDefinition } from './types';
import { consumeOpenAIToolStream } from './openai-stream-tools';
import { extractJsonStringField } from '$lib/shared/partial-json';

// Emits visible assistant text to the client wire as it arrives.
type Emit = (text: string) => void;
// Fired per tool-args delta; lets the streamer push live document fragments.
type OnToolArgsDelta = (index: number, name: string, argsSoFar: string) => void;

/**
 * Build a per-round document streamer: as a create/update tool call's args grow,
 * decode the partial `content_json` value and push it to the client wire as
 * `__DOC__:start` (once) + `__DOC__:delta` (the newly streamed text). The live
 * preview reassembles the deltas and renders the half-written document.
 *
 * Fresh per model round so tool-call indices (which restart at 0 each completion)
 * never collide with a previous round's accumulated length.
 */
function makeDocStreamer(
	controller: ReadableStreamDefaultController<Uint8Array>,
	encoder: TextEncoder
): OnToolArgsDelta {
	const state = new Map<number, { started: boolean; sentLen: number }>();
	const send = (event: string, data: string) => {
		try { controller.enqueue(encoder.encode(`__DOC__:${event}:${data}\n`)); } catch {}
	};
	return (idx, name, args) => {
		// Only creates use the live typewriter overlay; edits reload + animate just
		// the changed blocks client-side, so don't stream their content as an overlay.
		if (name !== 'create_document') return;
		const content = extractJsonStringField(args, 'content_json');
		if (content === null) return; // content_json hasn't started streaming yet
		let st = state.get(idx);
		if (!st) { st = { started: false, sentLen: 0 }; state.set(idx, st); }
		if (!st.started) {
			const title = extractJsonStringField(args, 'title') || '';
			const documentId = extractJsonStringField(args, 'document_id') || '';
			send('start', JSON.stringify({ title, document_id: documentId }));
			st.started = true;
		}
		if (content.length > st.sentLen) {
			send('delta', JSON.stringify(content.slice(st.sentLen)));
			st.sentLen = content.length;
		}
	};
}

// Cap tool→follow-up cycles so a confused model can't loop indefinitely.
const MAX_TOOL_ROUNDS = 6;

export async function streamAIWithTools(
	connector: AIConnector,
	messages: ChatMessage[],
	systemPrompt: string,
	tools: ToolDefinition[],
	onToolCall: (tc: ToolCall) => Promise<{ result: string }>,
	signal?: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
	const { provider } = connector;
	const encoder = new TextEncoder();
	const workingMessages = [...messages];

	const emitToolEvent = (controller: ReadableStreamDefaultController<Uint8Array>, event: string, data: Record<string, unknown>) => {
		try { controller.enqueue(encoder.encode(`__TOOL__:${event}:${JSON.stringify(data)}\n`)); } catch {}
	};

	return new ReadableStream({
		async start(controller) {
			let closed = false;
			const hbTimer = setInterval(() => {
				if (closed) return;
				try { controller.enqueue(encoder.encode(' ')); } catch { closed = true; }
			}, 3000);

			// Visible text streams to the client wire live; provider callers push
			// their text through this (so we never double-enqueue here).
			const emit: Emit = (text) => {
				try { controller.enqueue(encoder.encode(text)); } catch {}
			};
			// Bound emitters for providers that own their tool loop (Gemini).
			const emitTool = (event: string, data: Record<string, unknown>) => emitToolEvent(controller, event, data);
			const emitDoc = (event: string, data: string) => {
				try { controller.enqueue(encoder.encode(`__DOC__:${event}:${data}\n`)); } catch {}
			};
			let toolRounds = 0;

			try {
				while (true) {
					if (signal?.aborted) break;

					let response: ToolCallResponse;
					if (provider === 'openai' || provider === 'minimax') {
						// MiniMax is OpenAI-compatible (tools + tool_choice + tool_calls).
						// Stream partial doc content to the client for live preview.
						const onDocArgs = makeDocStreamer(controller, encoder);
						response = await callOpenAIWithTools(connector, workingMessages, systemPrompt, tools, signal, emit, onDocArgs);
					} else if (provider === 'anthropic') {
						response = await callAnthropicWithTools(connector, workingMessages, systemPrompt, tools, signal, emit);
					} else if (provider === 'gemini') {
						// Gemini owns its full agentic loop (native multi-turn function
						// calling needs thoughtSignature + functionResponse, unlike the
						// generic text-result loop). It streams text + doc itself.
						await runGeminiToolAgent(connector, workingMessages, systemPrompt, tools, signal, emit, onToolCall, emitTool, emitDoc);
						break;
					} else {
						throw new Error(`Tool calling not supported for provider: ${provider}`);
					}

					if (signal?.aborted) break;

					// If the model wants to use tools
					if (response.toolCalls && response.toolCalls.length > 0) {
						// The assistant turn = its real preamble, never a synthetic note:
						// the model parrots assistant-format notes into its next reply.
						if (response.text) workingMessages.push({ role: 'assistant', content: response.text });
						const resultLines: string[] = [];

						// Execute each tool call
						for (let i = 0; i < response.toolCalls.length; i++) {
							const tc = response.toolCalls[i];
							emitToolEvent(controller, 'start', { name: tc.name, label: (tc.arguments?.title as string) || (tc.arguments?.document_id as string) || '', index: i });

							try {
								const { result } = await onToolCall(tc);
								emitToolEvent(controller, 'done', { name: tc.name, result, index: i });
								resultLines.push(`- ${tc.name}: ${result}`);
							} catch (e) {
								const errMsg = (e as Error).message;
								emitToolEvent(controller, 'error', { name: tc.name, error: errMsg, index: i });
								resultLines.push(`- ${tc.name}: ERROR ${errMsg}`);
							}
						}

						// Feed results back as a user-role tool message (not a fake
						// assistant turn) so the model writes a real final reply rather
						// than parroting an assistant-format note.
						workingMessages.push({
							role: 'user',
							content: `Hasil eksekusi tool:\n${resultLines.join('\n')}\n\nBalas singkat ke user dalam bahasa yang sama. Jangan menyebut tool, JSON, atau document_id.`
						});

						if (++toolRounds >= MAX_TOOL_ROUNDS) break;
						continue;
					}

					// No tool calls — text already streamed via `emit`. Finish.
					break;
				}
			} catch (e: any) {
				console.error(`[TOOLS] error:`, e?.message || e);
				try {
					controller.enqueue(encoder.encode(`\n__ERROR__:${e?.message || String(e)}`));
				} catch {}
			} finally {
				closed = true;
				clearInterval(hbTimer);
				try { controller.close(); } catch {}
			}
		},
		cancel() {}
	});
}

async function callOpenAIWithTools(
	connector: AIConnector,
	messages: ChatMessage[],
	systemPrompt: string,
	tools: ToolDefinition[],
	signal: AbortSignal | undefined,
	emit: Emit,
	onToolArgsDelta?: OnToolArgsDelta
): Promise<ToolCallResponse> {
	const { base_url, model_name, api_key } = connector;
	const url = `${base_url.replace(/\/+$/, '')}/chat/completions`;

	const openaiTools = tools.map(t => ({
		type: 'function',
		function: {
			name: t.name,
			description: t.description,
			parameters: t.parameters
		}
	}));

	const body: Record<string, unknown> = {
		model: model_name,
		messages: [
			{ role: 'system', content: systemPrompt },
			...messages.map(m => ({
				role: m.role,
				content: m.content
			}))
		],
		tools: openaiTools,
		tool_choice: 'auto',
		max_tokens: 16384,
		// Streaming keeps the connection alive through MiniMax-M3's long <think>
		// reasoning. The non-streaming endpoint caps such requests at ~30s and
		// returns a body that strips to empty (truncated mid-reasoning).
		stream: true
	};

	// Guard only the connect/headers phase; once bytes flow, the idle watchdog
	// inside consumeOpenAIToolStream governs liveness. A user abort cancels both.
	const connectController = new AbortController();
	const connectTimer = setTimeout(() => connectController.abort(new Error('Upstream connect timeout after 60s')), 60000);
	signal?.addEventListener('abort', () => connectController.abort(signal.reason), { once: true });

	let res: Response;
	try {
		res = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(api_key ? { Authorization: `Bearer ${api_key}` } : {})
			},
			body: JSON.stringify(body),
			signal: connectController.signal
		});
	} finally {
		clearTimeout(connectTimer);
	}

	if (!res.ok) {
		const err = await res.text();
		throw new Error(`OpenAI API error: ${res.status} - ${err}`);
	}
	if (!res.body) throw new Error('No response body');

	return consumeOpenAIToolStream(res.body, emit, signal, undefined, onToolArgsDelta);
}

async function callAnthropicWithTools(
	connector: AIConnector,
	messages: ChatMessage[],
	systemPrompt: string,
	tools: ToolDefinition[],
	signal: AbortSignal | undefined,
	emit: Emit
): Promise<ToolCallResponse> {
	const { base_url, model_name, api_key } = connector;
	const url = `${base_url.replace(/\/+$/, '')}/v1/messages`;

	const anthropicTools = tools.map(t => ({
		name: t.name,
		description: t.description,
		input_schema: t.parameters
	}));

	const chatMsgs = messages.map(m => ({
		role: m.role,
		content: m.content
	}));

	const res = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': api_key,
			'anthropic-version': '2023-06-01'
		},
		body: JSON.stringify({
			model: model_name,
			max_tokens: 8192,
			system: systemPrompt,
			messages: chatMsgs,
			tools: anthropicTools
		}),
		signal
	});

	if (!res.ok) {
		const err = await res.text();
		throw new Error(`Anthropic API error: ${res.status} - ${err}`);
	}

	const data = await res.json();
	const content = data.content || [];
	const textBlocks = content.filter((b: any) => b.type === 'text');
	const toolBlocks = content.filter((b: any) => b.type === 'tool_use');

	const text = textBlocks.map((b: any) => b.text).join('') || null;
	const toolCalls: ToolCall[] | null = toolBlocks.length > 0
		? toolBlocks.map((b: any) => ({
			name: b.name,
			arguments: b.input || {}
		}))
		: null;

	if (text) emit(text);
	return { text, toolCalls, finishReason: data.stop_reason || 'end_turn' };
}

function safeParseResult(result: string): Record<string, unknown> {
	try {
		const o = JSON.parse(result);
		return o && typeof o === 'object' ? o : { result };
	} catch {
		return { result };
	}
}

/**
 * Stream one Gemini turn over SSE. Emits visible text deltas live (token-by-token)
 * and returns the model's raw parts (preserved verbatim so we can echo them back
 * with their thoughtSignature) plus any function calls it requested.
 */
async function streamGeminiTurn(
	url: string,
	contents: unknown[],
	systemPrompt: string,
	functionDeclarations: unknown[],
	signal: AbortSignal | undefined,
	emit: Emit,
	allowThinking: boolean
): Promise<{ modelParts: any[]; functionCalls: { name: string; args: Record<string, unknown> }[]; thinkingRejected: boolean }> {
	// thinkingLevel:'low' keeps gemini-3 from spending the whole output budget on
	// reasoning (which left the document empty / hit MAX_TOKENS). Not every model
	// (e.g. gemini-2.5-flash) accepts it, so fall back to no thinkingConfig on a 400
	// that rejects it — the caller then stops sending it for the rest of the run.
	const buildBody = (withThinking: boolean) => JSON.stringify({
		contents,
		systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
		tools: [{ functionDeclarations }],
		generationConfig: {
			temperature: 0.7,
			maxOutputTokens: 16384,
			...(withThinking ? { thinkingConfig: { thinkingLevel: 'low' } } : {})
		}
	});

	const post = (withThinking: boolean) => fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: buildBody(withThinking),
		signal
	});

	let thinkingRejected = false;
	let res = await post(allowThinking);
	if (!res.ok) {
		const err = await res.text();
		if (allowThinking && res.status === 400 && /thinking/i.test(err)) {
			thinkingRejected = true;
			res = await post(false); // model doesn't support thinkingConfig — retry plain
			if (!res.ok) throw new Error(`Gemini API error: ${res.status} - ${await res.text()}`);
		} else {
			throw new Error(`Gemini API error: ${res.status} - ${err}`);
		}
	}
	if (!res.body) throw new Error('No response body');

	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	const modelParts: any[] = [];
	const functionCalls: { name: string; args: Record<string, unknown> }[] = [];
	let buffer = '';

	try {
		while (true) {
			if (signal?.aborted) { reader.cancel('aborted').catch(() => {}); break; }
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			let nl: number;
			while ((nl = buffer.indexOf('\n')) !== -1) {
				const line = buffer.slice(0, nl).trim();
				buffer = buffer.slice(nl + 1);
				if (!line.startsWith('data:')) continue;
				const data = line.slice(line.indexOf(':') + 1).trim();
				if (!data || data === '[DONE]') continue;
				let parsed: any;
				try { parsed = JSON.parse(data); } catch { continue; }
				const parts = parsed.candidates?.[0]?.content?.parts || [];
				for (const p of parts) {
					modelParts.push(p);
					if (p.functionCall) {
						functionCalls.push({ name: p.functionCall.name, args: p.functionCall.args || {} });
					} else if (typeof p.text === 'string' && p.text && !p.thought) {
						emit(p.text); // visible reply, token-by-token
					}
				}
			}
		}
	} finally {
		reader.releaseLock?.();
	}

	return { modelParts, functionCalls, thinkingRejected };
}

/**
 * Gemini 3 streaming tool agent. Native function calling differs from OpenAI:
 *   1. Each functionCall arrives *whole* — args are not streamed token-by-token,
 *      so the document body lands at once (we still push it to the live preview).
 *   2. Continuing after a tool requires echoing the model's functionCall turn
 *      *including its thoughtSignature*, then a functionResponse turn. Skipping
 *      this makes the model re-issue the call (duplicate documents) and never
 *      write a final reply. The text reply DOES stream, so we emit it live.
 */
async function runGeminiToolAgent(
	connector: AIConnector,
	messages: ChatMessage[],
	systemPrompt: string,
	tools: ToolDefinition[],
	signal: AbortSignal | undefined,
	emit: Emit,
	onToolCall: (tc: ToolCall) => Promise<{ result: string }>,
	emitTool: (event: string, data: Record<string, unknown>) => void,
	emitDoc: (event: string, data: string) => void
): Promise<void> {
	const { base_url, model_name, api_key } = connector;
	const url = `${base_url.replace(/\/+$/, '')}/v1beta/models/${model_name}:streamGenerateContent?alt=sse&key=${api_key}`;
	const functionDeclarations = tools.map(t => ({ name: t.name, description: t.description, parameters: t.parameters }));

	const contents: any[] = messages.map(m => ({
		role: m.role === 'assistant' ? 'model' : 'user',
		parts: [{ text: m.content }]
	}));

	let allowThinking = true; // dropped for the run once a model rejects thinkingConfig
	for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
		if (signal?.aborted) return;
		const { modelParts, functionCalls, thinkingRejected } = await streamGeminiTurn(url, contents, systemPrompt, functionDeclarations, signal, emit, allowThinking);
		if (thinkingRejected) allowThinking = false;
		if (functionCalls.length === 0) return; // model wrote its final reply — done

		// Echo the model's functionCall turn verbatim (keeps thoughtSignature, which
		// Gemini 3 requires) before answering with the tool results.
		contents.push({ role: 'model', parts: modelParts });

		const responseParts: any[] = [];
		for (let i = 0; i < functionCalls.length; i++) {
			const fc = functionCalls[i];
			const tc: ToolCall = { name: fc.name, arguments: fc.args };
			// Only creates use the live typewriter overlay; edits reload + animate just
			// the changed blocks client-side. Surface the new doc in the preview at once.
			const contentJson = (fc.args?.content_json as string) || '';
			if (fc.name === 'create_document' && contentJson) {
				emitDoc('start', JSON.stringify({ title: (fc.args?.title as string) || '', document_id: (fc.args?.document_id as string) || '' }));
				emitDoc('delta', JSON.stringify(contentJson));
			}
			emitTool('start', { name: fc.name, label: (fc.args?.title as string) || (fc.args?.document_id as string) || '', index: i });
			try {
				const { result } = await onToolCall(tc);
				emitTool('done', { name: fc.name, result, index: i });
				responseParts.push({ functionResponse: { name: fc.name, response: safeParseResult(result) } });
			} catch (e) {
				const errMsg = (e as Error).message;
				emitTool('error', { name: fc.name, error: errMsg, index: i });
				responseParts.push({ functionResponse: { name: fc.name, response: { success: false, error: errMsg } } });
			}
		}
		contents.push({ role: 'user', parts: responseParts });
	}
}
