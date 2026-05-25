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
	systemPrompt: string
): Promise<ReadableStream<Uint8Array>> {
	const { provider, base_url, model_name, api_key } = connector;

	const formattedMessages = [
		{ role: 'system', content: systemPrompt },
		...messages
	];

	switch (provider) {
		case 'openai':
			return streamOpenAI(base_url, model_name, api_key, formattedMessages);
		case 'anthropic':
			return streamAnthropic(base_url, model_name, api_key, formattedMessages);
		case 'gemini':
			return streamGemini(base_url, model_name, api_key, messages, systemPrompt);
		default:
			throw new Error(`Unknown provider: ${provider}`);
	}
}

async function streamOpenAI(
	baseUrl: string,
	model: string,
	apiKey: string,
	messages: { role: string; content: string }[]
): Promise<ReadableStream<Uint8Array>> {
	const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
		},
		body: JSON.stringify({
			model,
			messages,
			stream: true
		})
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`OpenAI API error: ${response.status} - ${error}`);
	}

	if (!response.body) throw new Error('No response body');

	// Transform SSE stream to extract text deltas
	const reader = response.body.getReader();
	const decoder = new TextDecoder();

	return new ReadableStream({
		async pull(controller) {
			try {
				const { done, value } = await reader.read();
				if (done) {
					controller.close();
					return;
				}

				const text = decoder.decode(value, { stream: true });
				const lines = text.split('\n');

				for (const line of lines) {
					const trimmed = line.trim();
					if (!trimmed || !trimmed.startsWith('data: ')) continue;
					const data = trimmed.slice(6);
					if (data === '[DONE]') continue;

					try {
						const parsed = JSON.parse(data);
						const content = parsed.choices?.[0]?.delta?.content;
						if (content) {
							controller.enqueue(new TextEncoder().encode(content));
						}
					} catch {
						// Skip malformed JSON chunks
					}
				}
			} catch (err) {
				controller.error(err);
			}
		},
		cancel() {
			reader.cancel();
		}
	});
}

async function streamAnthropic(
	baseUrl: string,
	model: string,
	apiKey: string,
	messages: { role: string; content: string }[]
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
		})
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Anthropic API error: ${response.status} - ${error}`);
	}

	if (!response.body) throw new Error('No response body');

	const reader = response.body.getReader();
	const decoder = new TextDecoder();

	return new ReadableStream({
		async pull(controller) {
			try {
				const { done, value } = await reader.read();
				if (done) {
					controller.close();
					return;
				}

				const text = decoder.decode(value, { stream: true });
				const lines = text.split('\n');

				for (const line of lines) {
					const trimmed = line.trim();
					if (!trimmed.startsWith('data: ')) continue;
					const data = trimmed.slice(6);

					try {
						const parsed = JSON.parse(data);
						if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
							controller.enqueue(new TextEncoder().encode(parsed.delta.text));
						}
					} catch {
						// Skip malformed JSON
					}
				}
			} catch (err) {
				controller.error(err);
			}
		},
		cancel() {
			reader.cancel();
		}
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
	systemPrompt: string
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
		})
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Gemini API error: ${response.status} - ${error}`);
	}

	if (!response.body) throw new Error('No response body');

	const reader = response.body.getReader();
	const decoder = new TextDecoder();

	return new ReadableStream({
		async pull(controller) {
			try {
				const { done, value } = await reader.read();
				if (done) {
					controller.close();
					return;
				}

				const text = decoder.decode(value, { stream: true });
				const lines = text.split('\n');

				for (const line of lines) {
					const trimmed = line.trim();
					if (!trimmed.startsWith('data: ')) continue;
					const data = trimmed.slice(6);

					try {
						const parsed = JSON.parse(data);
						const textPart = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
						if (textPart) {
							controller.enqueue(new TextEncoder().encode(textPart));
						}
					} catch {
						// Skip malformed JSON
					}
				}
			} catch (err) {
				controller.error(err);
			}
		},
		cancel() {
			reader.cancel();
		}
	});
}