/**
 * TOC tooling shared across preview, docx exporter, and pdf exporter.
 *
 * Contract for AI-produced documents:
 *  - A block of `{ "type": "toc", "label"?: string }` is auto-expanded.
 *  - The expander scans subsequent blocks for `{ "type": "heading", "level": 2..maxLevel, "text": "..." }`
 *    until it hits the next `toc`, `pageBreak`, or end-of-content.
 *  - Found headings are written back as `items: [{ text, level }]` on the same toc block.
 *  - If the AI already provided `items`, they win — useful for custom labels or manual ordering.
 *  - Renderers should always render the `items` (if present) below the label, indented by level.
 *
 * This keeps the AI contract minimal (one block, optional label) while guaranteeing
 * correct rendering regardless of which AI produced the document.
 */

export interface TocItem {
	text: string;
	level: number;
	page?: number;
	anchor?: string;
}

export interface TocBlock {
	type: 'toc';
	label?: string;
	items?: TocItem[];
	minLevel?: number;
	maxLevel?: number;
}

export interface HeadingBlock {
	type: 'heading';
	level?: number;
	text?: string;
	runs?: Array<{ text?: string }>;
}

export interface NormalizeOptions {
	minLevel?: number;
	maxLevel?: number;
	defaultLabel?: string;
}

const DEFAULT_MIN = 2;
const DEFAULT_MAX = 4;

function headingText(el: HeadingBlock): string {
	if (typeof el.text === 'string' && el.text.trim()) return el.text.trim();
	if (Array.isArray(el.runs)) {
		return el.runs.map((r) => r?.text ?? '').join('').trim();
	}
	return '';
}

function slugify(s: string): string {
	return s
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 64);
}

export function extractHeadings(
	content: any[],
	startIndex = 0,
	opts: NormalizeOptions = {}
): TocItem[] {
	const min = opts.minLevel ?? DEFAULT_MIN;
	const max = opts.maxLevel ?? DEFAULT_MAX;
	const out: TocItem[] = [];
	const used = new Set<string>();
	for (let i = startIndex; i < content.length; i++) {
		const el = content[i];
		if (!el || typeof el !== 'object') continue;
		if (el.type === 'toc') break;
		if (el.type !== 'heading') continue;
		const lvl = Number(el.level) || 1;
		if (lvl < min || lvl > max) continue;
		const text = headingText(el as HeadingBlock);
		if (!text) continue;
		let anchor = slugify(text);
		if (used.has(anchor)) {
			let n = 2;
			while (used.has(`${anchor}-${n}`)) n++;
			anchor = `${anchor}-${n}`;
		}
		used.add(anchor);
		out.push({ text, level: lvl, anchor });
	}
	return out;
}

/**
 * Walks the document and fills `items` on any `toc` block missing them.
 * Mutates the doc in place and returns it for chaining.
 *
 * Idempotent: re-running with the same content yields the same result.
 */
export function normalizeDoc<T extends { content: any[] }>(doc: T, opts: NormalizeOptions = {}): T {
	if (!doc || !Array.isArray(doc.content)) return doc;
	for (let i = 0; i < doc.content.length; i++) {
		const el = doc.content[i];
		if (!el || el.type !== 'toc') continue;
		const block = el as TocBlock;
		if (Array.isArray(block.items) && block.items.length > 0) continue;
		const min = block.minLevel ?? opts.minLevel ?? DEFAULT_MIN;
		const max = block.maxLevel ?? opts.maxLevel ?? DEFAULT_MAX;
		block.items = extractHeadings(doc.content, i + 1, { minLevel: min, maxLevel: max });
	}
	return doc;
}

export function defaultTocLabel(): string {
	return 'Table of Contents';
}
