// Strip thinking blocks / code fences / leading prose from a model-emitted
// content_json string, leaving the bare JSON object. Shared by create + update.
export function cleanContentJson(raw: string): string {
	let s = (raw || '').trim();
	s = s.replace(/<think>[\s\S]*?<\/think>/g, '');
	s = s.replace(/```(?:json)?\s*/gi, '');
	s = s.replace(/```\s*$/g, '');
	const braceIdx = s.indexOf('{');
	if (braceIdx > 0) s = s.slice(braceIdx);
	return s;
}
