import { defaultTocLabel, type TocItem } from '$lib/shared/toc';
import { ILLUSTRATION_DEFAULT_W, ILLUSTRATION_DEFAULT_H } from '$lib/shared/illustration';

export const PAGEBREAK_MARKER = '__PAGEBREAK__';

export function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Lenient parse of a (possibly half-streamed / fenced) document JSON string into
 * `{ meta, content }`. Falls back to brace-matching individual elements when the
 * whole blob doesn't parse yet, so live preview works mid-generation.
 */
export function salvageDoc(content: string): { meta: any; content: any[] } | null {
	let s = content.replace(/<think>[\s\S]*?<\/think>/g, '');
	s = s.replace(/<think>[\s\S]*$/, '');
	s = s.replace(/```(?:json)?\s*/gi, '');
	s = s.replace(/```\s*$/g, '');
	const braceIdx = s.indexOf('{');
	if (braceIdx < 0) return null;
	s = s.slice(braceIdx).trim();

	try {
		const doc = JSON.parse(s);
		if (doc && Array.isArray(doc.content)) return doc;
	} catch {}

	let meta: any = {};
	const metaIdx = s.search(/"meta"\s*:\s*\{/);
	if (metaIdx >= 0) {
		const open = s.indexOf('{', metaIdx);
		let depth = 0, inStr = false, esc = false, j = open;
		for (; j < s.length; j++) {
			const c = s[j];
			if (esc) { esc = false; continue; }
			if (c === '\\') { esc = true; continue; }
			if (c === '"') { inStr = !inStr; continue; }
			if (inStr) continue;
			if (c === '{') depth++;
			else if (c === '}') { depth--; if (depth === 0) { j++; break; } }
		}
		if (depth === 0) {
			try { meta = JSON.parse(s.slice(open, j)); } catch {}
		}
	}

	const arrMatch = s.match(/"content"\s*:\s*\[/);
	if (!arrMatch || arrMatch.index === undefined) return null;
	let i = arrMatch.index + arrMatch[0].length;
	const elements: any[] = [];
	while (i < s.length) {
		while (i < s.length && /[\s,]/.test(s[i])) i++;
		if (i >= s.length || s[i] === ']') break;
		if (s[i] !== '{') break;
		let depth = 0, inStr = false, esc = false, j = i;
		for (; j < s.length; j++) {
			const c = s[j];
			if (esc) { esc = false; continue; }
			if (c === '\\') { esc = true; continue; }
			if (c === '"') { inStr = !inStr; continue; }
			if (inStr) continue;
			if (c === '{') depth++;
			else if (c === '}') { depth--; if (depth === 0) { j++; break; } }
		}
		if (depth !== 0) break;
		try { elements.push(JSON.parse(s.slice(i, j))); } catch { break; }
		i = j;
	}
	// Also render the in-progress trailing element (the one still being typed) so
	// the live preview reveals text word-by-word, not just whole-block-by-block.
	if (i < s.length) {
		while (i < s.length && /[\s,]/.test(s[i])) i++;
		if (s[i] === '{') {
			const frag = s.slice(i);
			// Back off to the longest parseable prefix so the block being typed stays
			// on screen between awkward token boundaries instead of flickering away.
			for (let cut = 0; cut <= Math.min(16, frag.length - 1); cut++) {
				const partial = repairPartialElement(frag.slice(0, frag.length - cut));
				if (partial) { elements.push(partial); break; }
			}
		}
	}
	if (elements.length === 0) return null;
	return { meta, content: elements };
}

/**
 * Best-effort parse of a half-streamed trailing element: close any open string /
 * brackets and drop dangling separators so the element being typed renders with
 * its partial text. Returns null if it still can't form a valid doc element —
 * the caller simply skips it that frame.
 */
function repairPartialElement(frag: string): any | null {
	let inStr = false, esc = false;
	const stack: string[] = [];
	for (let k = 0; k < frag.length; k++) {
		const c = frag[k];
		if (esc) { esc = false; continue; }
		if (c === '\\') { esc = true; continue; }
		if (inStr) { if (c === '"') inStr = false; continue; }
		if (c === '"') { inStr = true; continue; }
		if (c === '{' || c === '[') stack.push(c);
		else if (c === '}' || c === ']') stack.pop();
	}
	let out = frag;
	if (esc) out = out.slice(0, -1);   // dangling backslash
	if (inStr) out += '"';             // unterminated string
	out = out.replace(/[\s]*[,:]\s*$/, ''); // trailing separator with no value
	for (let k = stack.length - 1; k >= 0; k--) out += stack[k] === '{' ? '}' : ']';
	try {
		const o = JSON.parse(out);
		return o && typeof o === 'object' && o.type ? o : null;
	} catch {
		return null;
	}
}

/**
 * Render one document element to a preview HTML string. `ensureIllustration`
 * resolves an illustration's cached PNG src (or null while rendering); the caller
 * owns the cache + re-render trigger.
 */
export function renderBlock(
	el: any,
	bodySize: number,
	ensureIllustration: (html: string, width: number, height: number) => string | null
): string {
	const headingSizes: Record<number, number> = { 1: 1.6, 2: 1.3, 3: 1.15, 4: 1, 5: 0.9 };
	const headingColors: Record<number, string> = { 1: '#1e293b', 2: '#1e293b', 3: '#334155', 4: '#475569', 5: '#64748b' };
	switch (el.type) {
		case 'heading': {
			const lvl = Math.min(el.level || 1, 5);
			const sz = Math.round(bodySize * headingSizes[lvl] * 10) / 10;
			const clr = headingColors[lvl] || '#1e293b';
			const a = el.alignment === 'center' ? 'text-align:center;' : el.alignment === 'right' ? 'text-align:right;' : '';
			const t = (el.text || '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/`(.+?)`/g, '<code>$1</code>').replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:#3b82f6">$1</a>');
			return `<h${lvl} style="font-size:${sz}pt;font-weight:700;color:${clr};margin:${lvl===1?'24px':'16px'} 0 8px 0;${a}">${t}</h${lvl}>`;
		}
		case 'paragraph': {
			const a = el.alignment === 'center' ? 'text-align:center;' : el.alignment === 'right' ? 'text-align:right;' : '';
			let html = '';
			if (el.runs && Array.isArray(el.runs)) {
				html = (el.runs as any[]).map((r: any) => {
					let s = escapeHtml(r.text || '');
					if (r.bold) s = `<strong>${s}</strong>`;
					if (r.italic) s = `<em>${s}</em>`;
					if (r.underline) s = `<u>${s}</u>`;
					if (r.strike) s = `<s>${s}</s>`;
					if (r.link) s = `<a href="${escapeHtml(r.link)}" style="color:#3b82f6">${s}</a>`;
					if (r.color) s = `<span style="color:#${r.color}">${s}</span>`;
					return s;
				}).join('');
			} else {
				html = (el.text || '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/`(.+?)`/g, `<code style="font-family:'Courier New',monospace;font-size:${bodySize-0.5}pt;color:#dc2626">$1</code>`).replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:#3b82f6">$1</a>');
			}
			return `<p style="margin:6px 0;${a}">${html}</p>`;
		}
		case 'bullet':
			return '<ul style="margin:8px 0;padding-left:24px">' + (el.items || []).map((i: string) => `<li style="margin:2px 0">${escapeHtml(i)}</li>`).join('') + '</ul>';
		case 'numbered':
			return '<ol style="margin:8px 0;padding-left:24px">' + (el.items || []).map((i: string) => `<li style="margin:2px 0">${escapeHtml(i)}</li>`).join('') + '</ol>';
		case 'table': {
			let t = `<table style="border-collapse:collapse;width:100%;margin:12px 0;font-size:${Math.round((bodySize-1)*10)/10}pt">`;
			t += '<thead><tr>' + (el.headers || []).map((h: string) => `<th style="border:1px solid #d1d5db;padding:8px;background:#f3f4f6;font-weight:700;text-align:left;color:#1e293b">${escapeHtml(h)}</th>`).join('') + '</tr></thead>';
			t += '<tbody>' + (el.rows || []).map((row: string[]) => '<tr>' + row.map((c, i) => `<td style="border:1px solid #d1d5db;padding:6px;text-align:${(el.alignments || [])[i] || 'left'}">${escapeHtml(c || '')}</td>`).join('') + '</tr>').join('') + '</tbody>';
			t += '</table>';
			return t;
		}
		case 'hr':
			return '<hr style="border:none;border-top:1px solid #d1d5db;margin:16px 0">';
		case 'code':
			return `<pre style="background:#f3f4f6;padding:12px;border-radius:4px;overflow-x:auto;font-family:'Courier New',monospace;font-size:${bodySize-0.5}pt;color:#374151;margin:8px 0">${escapeHtml(el.text || '')}</pre>`;
		case 'quote':
			return `<blockquote style="border-left:4px solid #3b82f6;margin:12px 0;padding:8px 16px;background:#f8fafc;color:#475569;font-style:italic">${escapeHtml(el.text || '')}</blockquote>`;
		case 'illustration': {
			const w = Number(el.width) || ILLUSTRATION_DEFAULT_W;
			const h = Number(el.height) || ILLUSTRATION_DEFAULT_H;
			const cap = el.caption ? escapeHtml(el.caption) : '';
			const src = el.html ? ensureIllustration(String(el.html), w, h) : null;
			const inner = src
				? `<img src="${src}" alt="${cap || 'illustration'}" style="display:block;max-width:100%;height:auto" />`
				: `<div style="display:flex;align-items:center;justify-content:center;width:100%;aspect-ratio:${w}/${h};background:#f1f5f9;color:#94a3b8;font-size:${bodySize-1}pt;border:1px dashed #cbd5e1">Rendering illustration…</div>`;
			const capHtml = cap
				? `<div style="text-align:center;color:#64748b;font-size:${bodySize-1.5}pt;margin-top:4px;font-style:italic">${cap}</div>`
				: '';
			return `<figure style="margin:16px 0;text-align:center">${inner}${capHtml}</figure>`;
		}
		case 'image': {
			const w = Number(el.width) || 400;
			const cap = el.caption ? escapeHtml(el.caption) : '';
			const src = escapeHtml(el.src || '');
			if (!src) return '';
			const capHtml = cap
				? `<div style="text-align:center;color:#64748b;font-size:${bodySize-1.5}pt;margin-top:4px;font-style:italic">${cap}</div>`
				: '';
			return `<figure style="margin:16px 0;text-align:center"><img src="${src}" alt="${cap || 'image'}" style="display:block;max-width:${w}px;margin:0 auto;height:auto" />${capHtml}</figure>`;
		}
		case 'pageBreak':
			return PAGEBREAK_MARKER;
		case 'toc': {
			const label = escapeHtml(el.label || defaultTocLabel());
			const titleSize = Math.round(bodySize * 1.3 * 10) / 10;
			const items: TocItem[] = Array.isArray(el.items) ? el.items : [];
			let html = `<div style="margin:24px 0"><div style="text-align:center;color:#1e293b;font-weight:700;font-size:${titleSize}pt;margin-bottom:16px;letter-spacing:0.5px">${label}</div>`;
			if (items.length === 0) {
				html += `<div style="text-align:center;color:#94a3b8;font-style:italic;font-size:${bodySize-0.5}pt">(no headings found)</div>`;
			} else {
				html += '<div style="display:flex;flex-direction:column;gap:4px">';
				for (const it of items) {
					const indent = Math.max(0, (Number(it.level) || 2) - 2) * 20;
					const txt = escapeHtml(it.text || '');
					const page = it.page != null ? escapeHtml(String(it.page)) : '';
					html += `<div style="display:flex;align-items:flex-end;gap:8px;padding-left:${indent}px;line-height:1.4"><span>${txt}</span><span style="flex:1;border-bottom:1px dotted #cbd5e1;margin-bottom:5px;min-width:24px"></span>${page ? `<span style="color:#475569;font-variant-numeric:tabular-nums">${page}</span>` : ''}</div>`;
				}
				html += '</div>';
			}
			html += '</div>';
			return html;
		}
		default:
			return '';
	}
}
