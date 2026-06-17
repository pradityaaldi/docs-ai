import type { AIConnector, ChatMessage } from './types';
import { parseSSE } from './sse';
import { stripReasoningStream } from './reasoning';

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
		case 'minimax': // OpenAI-compatible
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

	// Strip any leading <think>…</think> reasoning (MiniMax M-series) live.
	return stripReasoningStream(parseSSE(response.body, (event) => {
		try {
			const parsed = JSON.parse(event);
			const choice = parsed.choices?.[0];
			const text = choice?.delta?.content || null;
			const done = !!choice?.finish_reason;
			return { text, done };
		} catch {
			return { text: null };
		}
	}));
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
