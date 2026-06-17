/**
 * Pull one string field out of a *partially streamed* JSON object literal.
 *
 * Tool-call arguments arrive token by token, so the args blob is usually not yet
 * valid JSON (`{"title":"Bab 1","content_json":"{\"meta\":…`). This decodes the
 * value of `field` as far as it has streamed — handling escapes and stopping at an
 * incomplete trailing escape — so callers can feed the growing value into a live
 * preview. Returns `null` until the field's opening quote has arrived.
 *
 * The decoded output is always a growing prefix: decoding a longer source yields
 * the same leading characters plus more, so callers may safely diff by length.
 */
export function extractJsonStringField(src: string, field: string): string | null {
	const key = `"${field}"`;
	const ki = src.indexOf(key);
	if (ki < 0) return null;

	let i = ki + key.length;
	while (i < src.length && /\s/.test(src[i])) i++;
	if (src[i] !== ':') return null;
	i++;
	while (i < src.length && /\s/.test(src[i])) i++;
	if (src[i] !== '"') return null; // value not a string, or not started yet
	i++; // past the opening quote

	let out = '';
	while (i < src.length) {
		const c = src[i];
		if (c === '\\') {
			const n = src[i + 1];
			if (n === undefined) break; // dangling backslash — escape not complete yet
			switch (n) {
				case '"': out += '"'; break;
				case '\\': out += '\\'; break;
				case '/': out += '/'; break;
				case 'n': out += '\n'; break;
				case 't': out += '\t'; break;
				case 'r': out += '\r'; break;
				case 'b': out += '\b'; break;
				case 'f': out += '\f'; break;
				case 'u': {
					const hex = src.slice(i + 2, i + 6);
					if (i + 6 > src.length || !/^[0-9a-fA-F]{4}$/.test(hex)) return out; // \uXXXX still streaming
					out += String.fromCharCode(parseInt(hex, 16));
					i += 6;
					continue;
				}
				default: out += n;
			}
			i += 2;
			continue;
		}
		if (c === '"') break; // closing quote — value complete
		out += c;
		i++;
	}
	return out;
}
