// Pure helpers for parsing streamed AI output (think tags, error sentinels, doc JSON).

export function stripThink(text: string): string {
	let s = text.replace(/<think>[\s\S]*?<\/think>/g, '');
	s = s.replace(/<think>[\s\S]*$/, '');
	return s;
}

export function extractError(raw: string): string | null {
	const idx = raw.indexOf('\n__ERROR__:');
	if (idx < 0) return null;
	return raw.slice(idx + '\n__ERROR__:'.length).trim();
}

export function stripError(raw: string): string {
	const idx = raw.indexOf('\n__ERROR__:');
	return idx >= 0 ? raw.slice(0, idx) : raw;
}

export function cleanDocJSON(raw: string): string {
	let s = raw.replace(/<think>[\s\S]*?<\/think>/g, '');
	s = s.replace(/<think>[\s\S]*$/, '');
	s = s.replace(/```(?:json)?\s*/gi, '');
	s = s.replace(/```\s*$/g, '');
	const braceIdx = s.indexOf('{');
	if (braceIdx < 0) return '';
	s = s.slice(braceIdx);
	return s.trim();
}
