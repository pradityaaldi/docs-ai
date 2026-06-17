import type { AIConnector } from './types';

export async function testConnectorConnection(
	connector: Pick<AIConnector, 'provider' | 'base_url' | 'model_name' | 'api_key'>
): Promise<{ success: boolean; error?: string }> {
	const { provider, base_url, model_name, api_key } = connector;
	const cleanUrl = base_url.replace(/\/+$/, '');

	switch (provider) {
		case 'openai':
		case 'minimax': {
			// MiniMax is OpenAI-compatible.
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
