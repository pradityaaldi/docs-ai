import { stripReasoning } from '../ai/reasoning';
import type { DocxContent } from './types';

// Robust extraction + validation of AI-produced DOCX-JSON. Models wrap output
// in reasoning blocks, code fences, and trailing prose, and occasionally emit
// invalid block shapes. These helpers recover the real document and drop junk
// so a single bad block never corrupts the whole export.

const KNOWN_TYPES = new Set([
	'heading', 'paragraph', 'bullet', 'numbered', 'table',
	'hr', 'code', 'quote', 'image', 'illustration', 'pageBreak', 'toc'
]);

/** Strip reasoning + code fences, leaving candidate JSON text. */
export function cleanJson(raw: string): string {
	let s = stripReasoning(raw);
	s = s.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');
	return s.trim();
}

/**
 * Scan for the first complete JSON value (object or array) starting at the
 * first `{`/`[`, honoring string literals and escapes. Far more reliable than
 * indexOf('{')..lastIndexOf('}') when the model appends prose or extra blocks.
 */
export function extractJson(raw: string): string | null {
	const s = cleanJson(raw);
	const start = s.search(/[{[]/);
	if (start === -1) return null;

	const open = s[start];
	const close = open === '{' ? '}' : ']';
	let depth = 0;
	let inStr = false;
	let escaped = false;

	for (let i = start; i < s.length; i++) {
		const ch = s[i];
		if (inStr) {
			if (escaped) escaped = false;
			else if (ch === '\\') escaped = true;
			else if (ch === '"') inStr = false;
			continue;
		}
		if (ch === '"') inStr = true;
		else if (ch === open) depth++;
		else if (ch === close) {
			depth--;
			if (depth === 0) return s.slice(start, i + 1);
		}
	}
	return null; // unbalanced (truncated response)
}

function asString(v: unknown): string {
	return typeof v === 'string' ? v : v == null ? '' : String(v);
}

/** Drop unknown/malformed blocks; coerce fields to expected shapes. */
export function validateBlocks(blocks: unknown[]): { blocks: DocxContent[]; warnings: string[] } {
	const out: DocxContent[] = [];
	const warnings: string[] = [];

	for (let i = 0; i < blocks.length; i++) {
		const b = blocks[i] as any;
		if (!b || typeof b !== 'object' || !KNOWN_TYPES.has(b.type)) {
			warnings.push(`block[${i}]: dropped (unknown type "${b?.type}")`);
			continue;
		}
		switch (b.type) {
			case 'heading': {
				const text = asString(b.text);
				if (!text && !Array.isArray(b.runs)) { warnings.push(`block[${i}] heading: empty`); continue; }
				const level = Math.min(5, Math.max(1, Number(b.level) || 1));
				out.push({ ...b, level, text });
				break;
			}
			case 'paragraph': {
				if (!asString(b.text) && !Array.isArray(b.runs)) { warnings.push(`block[${i}] paragraph: empty`); continue; }
				out.push({ ...b, text: asString(b.text) });
				break;
			}
			case 'bullet':
			case 'numbered': {
				const items = Array.isArray(b.items) ? b.items.map(asString).filter(Boolean) : [];
				if (!items.length) { warnings.push(`block[${i}] ${b.type}: no items`); continue; }
				out.push({ type: b.type, items });
				break;
			}
			case 'table': {
				const headers = Array.isArray(b.headers) ? b.headers.map(asString) : [];
				const rows = Array.isArray(b.rows) ? b.rows.filter(Array.isArray).map((r: unknown[]) => r.map(asString)) : [];
				if (!headers.length && !rows.length) { warnings.push(`block[${i}] table: empty`); continue; }
				out.push({ ...b, headers, rows });
				break;
			}
			case 'quote':
			case 'code': {
				const text = asString(b.text);
				if (!text) { warnings.push(`block[${i}] ${b.type}: empty`); continue; }
				out.push({ ...b, text });
				break;
			}
			default:
				out.push(b as DocxContent); // hr / pageBreak / toc / image / illustration
		}
	}
	return { blocks: out, warnings };
}

export interface ParseResult {
	content: DocxContent[];
	warnings: string[];
	ok: boolean; // true if JSON parsed (vs. raw-text fallback)
}

/**
 * Full pipeline: extract JSON → parse → unwrap {content:[…]} or bare [...] →
 * validate. ok=false means nothing parseable was found (caller may fall back).
 */
export function parseDocumentBlocks(raw: string): ParseResult {
	const jsonStr = extractJson(raw);
	if (!jsonStr) return { content: [], warnings: ['no JSON found'], ok: false };

	let parsed: unknown;
	try {
		parsed = JSON.parse(jsonStr);
	} catch (e) {
		return { content: [], warnings: [`JSON.parse failed: ${(e as Error).message}`], ok: false };
	}

	const arr = Array.isArray(parsed)
		? parsed
		: Array.isArray((parsed as any)?.content)
			? (parsed as any).content
			: null;
	if (!arr) return { content: [], warnings: ['parsed JSON has no content array'], ok: false };

	const { blocks, warnings } = validateBlocks(arr);
	return { content: blocks, warnings, ok: true };
}
