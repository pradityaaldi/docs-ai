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