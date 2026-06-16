export type AIProvider = 'openai' | 'anthropic' | 'gemini';

export interface AIConnector {
	id: string;
	name: string;
	provider: AIProvider;
	base_url: string;
	model_name: string;
	api_key: string;
	is_active: number;
}

export interface ChatMessage {
	role: 'user' | 'assistant';
	content: string;
}

export interface AIStreamChunk {
	type: 'text' | 'error' | 'done';
	content?: string;
}

export interface ToolDefinition {
	name: string;
	description: string;
	parameters: Record<string, unknown>;
}

export interface ToolCall {
	name: string;
	arguments: Record<string, unknown>;
}

export interface ToolCallResponse {
	text: string | null;
	toolCalls: ToolCall[] | null;
	finishReason: string;
}

export interface Usage {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
}

export interface CompletionResult {
	text: string;
	usage: Usage;
}

/**
 * Non-streaming single completion. Used for section-by-section server-side
 * document generation (single-shot per template). Returns text + token usage.
 */
export async function generateCompletion(
	connector: AIConnector,
	messages: ChatMessage[],
	systemPrompt: string,
	signal?: AbortSignal,
	maxTokens = 16384
): Promise<CompletionResult> {
	const { provider, base_url, model_name, api_key } = connector;
	const cleanUrl = base_url.replace(/\/+$/, '');

	if (provider === 'openai') {
		const res = await fetch(`${cleanUrl}/chat/completions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', ...(api_key ? { Authorization: `Bearer ${api_key}` } : {}) },
			body: JSON.stringify({
				model: model_name,
				messages: [{ role: 'system', content: systemPrompt }, ...messages],
				max_tokens: maxTokens
			}),
			signal
		});
		if (!res.ok) throw new Error(`OpenAI API error: ${res.status} - ${await res.text()}`);
		const data = await res.json();
		const text = data.choices?.[0]?.message?.content || '';
		const u = data.usage || {};
		return {
			text,
			usage: {
				promptTokens: u.prompt_tokens || 0,
				completionTokens: u.completion_tokens || 0,
				totalTokens: u.total_tokens || (u.prompt_tokens || 0) + (u.completion_tokens || 0)
			}
		};
	}

	if (provider === 'anthropic') {
		const res = await fetch(`${cleanUrl}/v1/messages`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'x-api-key': api_key, 'anthropic-version': '2023-06-01' },
			body: JSON.stringify({
				model: model_name,
				max_tokens: Math.min(maxTokens, 16384),
				system: systemPrompt,
				messages: messages.map((m) => ({ role: m.role, content: m.content }))
			}),
			signal
		});
		if (!res.ok) throw new Error(`Anthropic API error: ${res.status} - ${await res.text()}`);
		const data = await res.json();
		const text = (data.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
		const u = data.usage || {};
		return {
			text,
			usage: {
				promptTokens: u.input_tokens || 0,
				completionTokens: u.output_tokens || 0,
				totalTokens: (u.input_tokens || 0) + (u.output_tokens || 0)
			}
		};
	}

	if (provider === 'gemini') {
		const res = await fetch(`${cleanUrl}/v1beta/models/${model_name}:generateContent?key=${api_key}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
				systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
				generationConfig: { temperature: 0.7, maxOutputTokens: Math.min(maxTokens, 8192) }
			}),
			signal
		});
		if (!res.ok) throw new Error(`Gemini API error: ${res.status} - ${await res.text()}`);
		const data = await res.json();
		const text = (data.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('');
		const u = data.usageMetadata || {};
		return {
			text,
			usage: {
				promptTokens: u.promptTokenCount || 0,
				completionTokens: u.candidatesTokenCount || 0,
				totalTokens: u.totalTokenCount || 0
			}
		};
	}

	throw new Error(`Unknown provider: ${provider}`);
}

export async function streamAIResponse(
	connector: AIConnector,
	messages: ChatMessage[],
	systemPrompt: string,
	signal?: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
	const { provider, base_url, model_name, api_key } = connector;

	const formattedMessages = [
		{ role: 'system', content: systemPrompt },
		...messages
	];

	switch (provider) {
		case 'openai':
			return streamOpenAI(base_url, model_name, api_key, formattedMessages, signal);
		case 'anthropic':
			return streamAnthropic(base_url, model_name, api_key, formattedMessages, signal);
		case 'gemini':
			return streamGemini(base_url, model_name, api_key, messages, systemPrompt, signal);
		default:
			throw new Error(`Unknown provider: ${provider}`);
	}
}

async function streamOpenAI(
	baseUrl: string,
	model: string,
	apiKey: string,
	messages: { role: string; content: string }[],
	signal?: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
	const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
	const key = (apiKey || '').trim();

	const timeoutController = new AbortController();
	const timeoutId = setTimeout(() => timeoutController.abort(new Error('Upstream connect timeout after 60s')), 60000);
	signal?.addEventListener('abort', () => timeoutController.abort(signal.reason), { once: true });

	let response: Response;
	try {
		response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(key ? { Authorization: `Bearer ${key}` } : {})
			},
			body: JSON.stringify({
				model,
				messages,
				stream: true,
				max_tokens: 16384
			}),
			signal: timeoutController.signal
		});
	} finally {
		clearTimeout(timeoutId);
	}

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`OpenAI API error: ${response.status} - ${error}`);
	}

	if (!response.body) throw new Error('No response body');

	return parseSSE(response.body, (event) => {
		try {
			const parsed = JSON.parse(event);
			const choice = parsed.choices?.[0];
			const text = choice?.delta?.content || null;
			const done = !!choice?.finish_reason;
			return { text, done };
		} catch {
			return { text: null };
		}
	});
}

type ExtractResult = { text: string | null; done?: boolean };

function parseSSE(
	body: ReadableStream<Uint8Array>,
	extract: (data: string) => ExtractResult,
	idleMs = 10000
): ReadableStream<Uint8Array> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	const encoder = new TextEncoder();
	let buffer = '';
	let sawDone = false;

	const readWithIdleTimeout = (): Promise<{ done: boolean; value?: Uint8Array; timedOut?: boolean }> => {
		return new Promise((resolve, reject) => {
			let settled = false;
			const t = setTimeout(() => {
				if (settled) return;
				settled = true;
				console.warn(`[parseSSE] idle timeout after ${idleMs}ms — forcing close`);
				resolve({ done: true, timedOut: true });
			}, idleMs);
			reader.read().then(
				(r) => { if (settled) return; settled = true; clearTimeout(t); resolve(r); },
				(e) => { if (settled) return; settled = true; clearTimeout(t); reject(e); }
			);
		});
	};

	return new ReadableStream({
		async pull(controller) {
			try {
				const { done, value, timedOut } = await readWithIdleTimeout();
				if (done) {
					if (buffer.trim() && !timedOut) {
						const line = buffer.trim();
						if (line.startsWith('data: ')) {
							const data = line.slice(6);
							if (data !== '[DONE]') {
								const r = extract(data);
								if (r.text) controller.enqueue(encoder.encode(r.text));
							}
						}
					}
					if (timedOut) {
						reader.cancel('idle timeout').catch(() => {});
					}
					controller.close();
					return;
				}

				buffer += decoder.decode(value, { stream: true });
				let nlIdx: number;
				while ((nlIdx = buffer.indexOf('\n')) !== -1) {
					const line = buffer.slice(0, nlIdx).trim();
					buffer = buffer.slice(nlIdx + 1);
					if (!line || !line.startsWith('data: ')) continue;
					const data = line.slice(6);
					if (data === '[DONE]') { sawDone = true; continue; }
					const r = extract(data);
					if (r.text) controller.enqueue(encoder.encode(r.text));
					if (r.done) sawDone = true;
				}
				if (sawDone) {
					console.log('[parseSSE] done sentinel/finish_reason — closing');
					reader.cancel('done sentinel').catch(() => {});
					controller.close();
				}
			} catch (err) {
				controller.error(err);
			}
		},
		cancel(reason) {
			reader.cancel(reason).catch(() => {});
		}
	});
}

async function streamAnthropic(
	baseUrl: string,
	model: string,
	apiKey: string,
	messages: { role: string; content: string }[],
	signal?: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
	const url = `${baseUrl.replace(/\/+$/, '')}/v1/messages`;

	// Anthropic requires system message separate
	const systemMsg = messages.find((m) => m.role === 'system')?.content || '';
	const chatMsgs = messages.filter((m) => m.role !== 'system');

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': apiKey,
			'anthropic-version': '2023-06-01'
		},
		body: JSON.stringify({
			model,
			max_tokens: 8192,
			system: systemMsg,
			messages: chatMsgs,
			stream: true
		}),
		signal
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Anthropic API error: ${response.status} - ${error}`);
	}

	if (!response.body) throw new Error('No response body');

	return parseSSE(response.body, (event) => {
		try {
			const parsed = JSON.parse(event);
			if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
				return { text: parsed.delta.text };
			}
			if (parsed.type === 'message_stop') {
				return { text: null, done: true };
			}
		} catch {}
		return { text: null };
	});
}

export async function testConnectorConnection(
	connector: Pick<AIConnector, 'provider' | 'base_url' | 'model_name' | 'api_key'>
): Promise<{ success: boolean; error?: string }> {
	const { provider, base_url, model_name, api_key } = connector;
	const cleanUrl = base_url.replace(/\/+$/, '');

	switch (provider) {
		case 'openai': {
			try {
				const res = await fetch(`${cleanUrl}/chat/completions`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						...(api_key ? { Authorization: `Bearer ${api_key}` } : {})
					},
					body: JSON.stringify({
						model: model_name,
						messages: [{ role: 'user', content: 'Hi' }],
						max_tokens: 1
					})
				});
				if (res.ok) return { success: true };
				const err = await res.text();
				return { success: false, error: `${res.status}: ${err}` };
			} catch (e) {
				return { success: false, error: (e as Error).message };
			}
		}
		case 'anthropic': {
			try {
				const res = await fetch(`${cleanUrl}/v1/messages`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'x-api-key': api_key,
						'anthropic-version': '2023-06-01'
					},
					body: JSON.stringify({
						model: model_name,
						max_tokens: 1,
						messages: [{ role: 'user', content: 'Hi' }]
					})
				});
				if (res.ok) return { success: true };
				const err = await res.text();
				return { success: false, error: `${res.status}: ${err}` };
			} catch (e) {
				return { success: false, error: (e as Error).message };
			}
		}
		case 'gemini': {
			try {
				const res = await fetch(
					`${cleanUrl}/v1beta/models/${model_name}:generateContent?key=${api_key}`,
					{
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
							generationConfig: { maxOutputTokens: 1 }
						})
					}
				);
				if (res.ok) return { success: true };
				const err = await res.text();
				return { success: false, error: `${res.status}: ${err}` };
			} catch (e) {
				return { success: false, error: (e as Error).message };
			}
		}
		default:
			return { success: false, error: `Unknown provider: ${provider}` };
	}
}

async function streamGemini(
	baseUrl: string,
	model: string,
	apiKey: string,
	messages: ChatMessage[],
	systemPrompt: string,
	signal?: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
	const url = `${baseUrl.replace(/\/+$/, '')}/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

	const contents = messages.map((m) => ({
		role: m.role === 'assistant' ? 'model' : 'user',
		parts: [{ text: m.content }]
	}));

	const response = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			contents,
			systemInstruction: systemPrompt
				? { parts: [{ text: systemPrompt }] }
				: undefined,
			generationConfig: {
				temperature: 0.7,
				maxOutputTokens: 8192
			}
		}),
		signal
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Gemini API error: ${response.status} - ${error}`);
	}

	if (!response.body) throw new Error('No response body');

	return parseSSE(response.body, (event) => {
		try {
			const parsed = JSON.parse(event);
			const cand = parsed.candidates?.[0];
			const text = cand?.content?.parts?.[0]?.text || null;
			const done = !!cand?.finishReason;
			return { text, done };
		} catch {
			return { text: null };
		}
	});
}

// ── Tool Calling Infrastructure ──

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

			try {
				while (true) {
					if (signal?.aborted) break;

					let response: ToolCallResponse;
					if (provider === 'openai') {
						response = await callOpenAIWithTools(connector, workingMessages, systemPrompt, tools, signal);
					} else if (provider === 'anthropic') {
						response = await callAnthropicWithTools(connector, workingMessages, systemPrompt, tools, signal);
					} else if (provider === 'gemini') {
						response = await callGeminiWithTools(connector, workingMessages, systemPrompt, tools, signal);
					} else {
						throw new Error(`Tool calling not supported for provider: ${provider}`);
					}

					if (signal?.aborted) break;

					// If the model wants to use tools
					if (response.toolCalls && response.toolCalls.length > 0) {
						// Add assistant message with tool calls to history
						const toolCallParts = response.toolCalls.map(tc => ({
							type: 'tool_call' as const,
							name: tc.name,
							arguments: tc.arguments,
						}));
						workingMessages.push({ role: 'assistant', content: JSON.stringify({ tool_calls: toolCallParts }) });

						// Execute each tool call
						for (let i = 0; i < response.toolCalls.length; i++) {
							const tc = response.toolCalls[i];
							emitToolEvent(controller, 'start', { name: tc.name, arguments: tc.arguments, index: i });

							try {
								const { result } = await onToolCall(tc);
								emitToolEvent(controller, 'done', { name: tc.name, result, index: i });
								// Add tool result message
								workingMessages.push({
									role: 'assistant' as const,
									content: `Tool result for ${tc.name}: ${result}`
								});
							} catch (e) {
								const errMsg = (e as Error).message;
								emitToolEvent(controller, 'error', { name: tc.name, error: errMsg, index: i });
								workingMessages.push({
									role: 'assistant' as const,
									content: `Tool error for ${tc.name}: ${errMsg}`
								});
							}
						}

						if (response.text) {
							try { controller.enqueue(encoder.encode(response.text)); } catch {}
						}
						// Continue loop for potential follow-up
						continue;
					}

					// No tool calls — emit text and finish
					if (response.text) {
						try { controller.enqueue(encoder.encode(response.text)); } catch {}
					}
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
	signal?: AbortSignal
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
		max_tokens: 16384
	};

	const res = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(api_key ? { Authorization: `Bearer ${api_key}` } : {})
		},
		body: JSON.stringify(body),
		signal
	});

	if (!res.ok) {
		const err = await res.text();
		throw new Error(`OpenAI API error: ${res.status} - ${err}`);
	}

	const data = await res.json();
	const choice = data.choices?.[0];
	const msg = choice?.message;

	if (msg?.tool_calls && msg.tool_calls.length > 0) {
		const toolCalls: ToolCall[] = msg.tool_calls.map((tc: any) => ({
			name: tc.function.name,
			arguments: tc.function.arguments ? JSON.parse(tc.function.arguments) : {}
		}));
		return { text: msg.content || null, toolCalls, finishReason: choice.finish_reason };
	}

	return { text: msg?.content || null, toolCalls: null, finishReason: choice?.finish_reason || 'stop' };
}

async function callAnthropicWithTools(
	connector: AIConnector,
	messages: ChatMessage[],
	systemPrompt: string,
	tools: ToolDefinition[],
	signal?: AbortSignal
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

	return { text, toolCalls, finishReason: data.stop_reason || 'end_turn' };
}

async function callGeminiWithTools(
	connector: AIConnector,
	messages: ChatMessage[],
	systemPrompt: string,
	tools: ToolDefinition[],
	signal?: AbortSignal
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

	return { text, toolCalls, finishReason: cand?.finishReason || 'STOP' };
}