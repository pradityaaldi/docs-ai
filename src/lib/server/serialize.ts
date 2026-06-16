// Convert Drizzle camelCase rows back to the snake_case shape the frontend uses.

function toSnakeKey(k: string): string {
	return k.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
}

export function snakeify<T = any>(input: any): T {
	if (Array.isArray(input)) return input.map((v) => snakeify(v)) as unknown as T;
	if (input instanceof Date) return input.toISOString() as unknown as T;
	if (input && typeof input === 'object') {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(input)) {
			out[toSnakeKey(k)] = snakeify(v);
		}
		return out as T;
	}
	return input as T;
}
