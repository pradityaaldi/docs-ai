import type { AIConnector, ChatMessage, ToolCall, ToolCallResponse, ToolDefinition } from './types';
import { consumeOpenAIToolStream } from './openai-stream-tools';

// Emits visible assistant text to the client wire as it arrives.
type Emit = (text: string) => void;

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
			let toolRounds = 0;

			try {
				while (true) {
					if (signal?.aborted) break;

					let response: ToolCallResponse;
					if (provider === 'openai' || provider === 'minimax') {
						// MiniMax is OpenAI-compatible (tools + tool_choice + tool_calls).
						response = await callOpenAIWithTools(connector, workingMessages, systemPrompt, tools, signal, emit);
					} else if (provider === 'anthropic') {
						response = await callAnthropicWithTools(connector, workingMessages, systemPrompt, tools, signal, emit);
					} else if (provider === 'gemini') {
						response = await callGeminiWithTools(connector, workingMessages, systemPrompt, tools, signal, emit);
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
	emit: Emit
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

	return consumeOpenAIToolStream(res.body, emit, signal);
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

async function callGeminiWithTools(
	connector: AIConnector,
	messages: ChatMessage[],
	systemPrompt: string,
	tools: ToolDefinition[],
	signal: AbortSignal | undefined,
	emit: Emit
): Promise<ToolCallResponse> {
	const { base_url, model_name, api_key } = connector;
	const url = `${base_url.replace(/\/+$/, '')}/v1beta/models/${model_name}:generateContent?key=${api_key}`;

	const functionDeclarations = tools.map(t => ({
		name: t.name,
		description: t.description,
		parameters: t.parameters
	}));

	const contents = messages.map(m => ({
		role: m.role === 'assistant' ? 'model' : 'user',
		parts: [{ text: m.content }]
	}));

	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			contents,
			systemInstruction: systemPrompt
				? { parts: [{ text: systemPrompt }] }
				: undefined,
			tools: [{ functionDeclarations }],
			generationConfig: {
				temperature: 0.7,
				maxOutputTokens: 8192
			}
		}),
		signal
	});

	if (!res.ok) {
		const err = await res.text();
		throw new Error(`Gemini API error: ${res.status} - ${err}`);
	}

	const data = await res.json();
	const cand = data.candidates?.[0];
	const parts = cand?.content?.parts || [];

	const textParts = parts.filter((p: any) => p.text && !p.functionCall);
	const funcParts = parts.filter((p: any) => p.functionCall);

	const text = textParts.map((p: any) => p.text).join('') || null;
	const toolCalls: ToolCall[] | null = funcParts.length > 0
		? funcParts.map((p: any) => ({
			name: p.functionCall.name,
			arguments: p.functionCall.args || {}
		}))
		: null;

	if (text) emit(text);
	return { text, toolCalls, finishReason: cand?.finishReason || 'STOP' };
}
