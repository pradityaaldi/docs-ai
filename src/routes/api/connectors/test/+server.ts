import { json } from '@sveltejs/kit';
import { testConnectorConnection } from '$lib/server/ai';

export async function POST({ request }) {
	const { provider, base_url, model_name, api_key } = await request.json();

	if (!provider || !base_url || !model_name) {
		return json({ success: false, error: 'Missing required fields: provider, base_url, model_name' }, { status: 400 });
	}

	const result = await testConnectorConnection({ provider, base_url, model_name, api_key });
	return json(result, { status: result.success ? 200 : 502 });
}
