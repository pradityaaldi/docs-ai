/**
 * Illustration renderer — converts HTML+CSS to PNG data URL via SVG foreignObject.
 *
 * AI contract: emit `{ type: "illustration", html: "...", width?: number, height?: number,
 * caption?: string }`. The renderer wraps the HTML in an inline SVG, paints it onto a
 * canvas, and returns a base64 PNG. Pure browser API — no extra deps.
 */

export interface IllustrationBlock {
	type: 'illustration';
	html: string;
	width?: number;
	height?: number;
	caption?: string;
	_renderedSrc?: string;
}

const DEFAULT_W = 640;
const DEFAULT_H = 400;
const SCALE = 2;

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

export function illustrationKey(html: string, width: number, height: number): string {
	let h = 5381;
	const s = `${width}x${height}:${html}`;
	for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
	return `ill_${(h >>> 0).toString(36)}_${s.length}`;
}

export function getCachedIllustration(key: string): string | undefined {
	return cache.get(key);
}

function escapeXml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function htmlToXhtml(html: string): string {
	const doc = new DOMParser().parseFromString(
		`<!DOCTYPE html><html><body><div id="__root__">${html}</div></body></html>`,
		'text/html'
	);
	const root = doc.getElementById('__root__');
	if (!root) return escapeXml(html);
	const serializer = new XMLSerializer();
	let out = '';
	for (const child of Array.from(root.childNodes)) {
		out += serializer.serializeToString(child);
	}
	return out;
}

function wrapHtmlAsSvg(html: string, width: number, height: number): string {
	const xhtml = htmlToXhtml(html);
	const body = `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;margin:0;padding:0;box-sizing:border-box;font-family:Arial,sans-serif;font-size:14px;color:#1e293b;background:#ffffff">${xhtml}</div>`;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%">${body}</foreignObject></svg>`;
}

export async function renderIllustration(
	html: string,
	width: number = DEFAULT_W,
	height: number = DEFAULT_H
): Promise<string> {
	const key = illustrationKey(html, width, height);
	const cached = cache.get(key);
	if (cached) return cached;
	const pending = inflight.get(key);
	if (pending) return pending;

	const p = (async () => {
		const svg = wrapHtmlAsSvg(html, width, height);
		const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
		try {
			const img = await loadImage(url);
			const canvas = document.createElement('canvas');
			canvas.width = width * SCALE;
			canvas.height = height * SCALE;
			const ctx = canvas.getContext('2d');
			if (!ctx) throw new Error('Canvas 2d context unavailable');
			ctx.fillStyle = '#ffffff';
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
			ctx.drawImage(img, 0, 0, width, height);
			const dataUrl = canvas.toDataURL('image/png');
			cache.set(key, dataUrl);
			return dataUrl;
		} finally {
			inflight.delete(key);
		}
	})();
	inflight.set(key, p);
	return p;
}

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error('SVG decode failed (likely malformed XHTML in illustration html)'));
		img.src = src;
	});
}

/**
 * Walks doc content, renders all illustration blocks, returns a deep-copied
 * doc with each illustration replaced by an image block carrying the PNG src.
 * Used before export so DOCX/PDF generators only see image blocks.
 */
export async function inlineIllustrations<T extends { content: any[] }>(doc: T): Promise<T> {
	if (!doc || !Array.isArray(doc.content)) return doc;
	const out = { ...doc, content: [...doc.content] };
	for (let i = 0; i < out.content.length; i++) {
		const el = out.content[i];
		if (!el || el.type !== 'illustration' || typeof el.html !== 'string') continue;
		const w = Number(el.width) || DEFAULT_W;
		const h = Number(el.height) || DEFAULT_H;
		try {
			const src = await renderIllustration(el.html, w, h);
			out.content[i] = { type: 'image', src, width: w, height: h, caption: el.caption };
		} catch (e) {
			out.content[i] = {
				type: 'paragraph',
				text: `[Illustration render failed: ${(e as Error).message}]`
			};
		}
	}
	return out;
}

export const ILLUSTRATION_DEFAULT_W = DEFAULT_W;
export const ILLUSTRATION_DEFAULT_H = DEFAULT_H;
