import type { AIConnector, ChatMessage, CompletionResult } from './types';
import { stripReasoning } from './reasoning';

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

	// MiniMax is OpenAI-compatible (Bearer auth, /chat/completions).
	if (provider === 'openai' || provider === 'minimax') {
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
		const text = stripReasoning(data.choices?.[0]?.message?.content || '');
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
