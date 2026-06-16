import { TextRun, HeadingLevel, AlignmentType, ExternalHyperlink } from 'docx';
import type { DocxRun } from './types';

export function decodeImageSrc(src?: string): { type: 'png' | 'jpg' | 'gif' | 'bmp'; data: Buffer } | null {
	if (!src) return null;
	const m = /^data:image\/(png|jpe?g|gif|bmp);base64,(.+)$/i.exec(src.trim());
	if (!m) return null;
	const ext = m[1].toLowerCase();
	const type = (ext === 'jpeg' ? 'jpg' : ext) as 'png' | 'jpg' | 'gif' | 'bmp';
	try {
		return { type, data: Buffer.from(m[2], 'base64') };
	} catch {
		return null;
	}
}

export function alignType(a?: string) {
	if (a === 'center') return AlignmentType.CENTER;
	if (a === 'right') return AlignmentType.RIGHT;
	return AlignmentType.LEFT;
}

export function headingLevel(level: number) {
	switch (level) {
		case 2: return HeadingLevel.HEADING_2;
		case 3: return HeadingLevel.HEADING_3;
		case 4: return HeadingLevel.HEADING_4;
		case 5: return HeadingLevel.HEADING_5;
		default: return HeadingLevel.HEADING_1;
	}
}

export function textToRuns(text: string, font: string, fontSize: number): DocxRun[] {
	const runs: DocxRun[] = [];
	const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\)|([^*`\[]+))/g;
	let match;
	while ((match = regex.exec(text)) !== null) {
		if (match[2]) runs.push({ text: match[2], bold: true });
		else if (match[3]) runs.push({ text: match[3], italic: true });
		else if (match[4]) runs.push({ text: match[4], font: 'Courier New', size: fontSize - 2 });
		else if (match[5] && match[6]) runs.push({ text: match[5], link: match[6] });
		else if (match[7]) runs.push({ text: match[7] });
	}
	return runs.length > 0 ? runs : [{ text }];
}

export function buildRuns(runs: DocxRun[], font: string, fontSize: number): (TextRun | ExternalHyperlink)[] {
	return runs.map((r) => {
		const tr = new TextRun({
			text: r.text,
			bold: r.bold ?? false,
			italics: r.italic ?? false,
			underline: r.underline ? {} : undefined,
			strike: r.strike ?? false,
			color: r.color,
			size: r.size ?? fontSize,
			font: r.font ?? font
		});
		if (r.link) {
			return new ExternalHyperlink({
				children: [new TextRun({ text: r.text, style: 'Hyperlink' })],
				link: r.link
			});
		}
		return tr;
	});
}

export function resolveRuns(el: { text?: string; runs?: DocxRun[] }, font: string, fontSize: number): DocxRun[] {
	if (el.runs) return el.runs;
	if (el.text) return textToRuns(el.text, font, fontSize);
	return [{ text: '' }];
}
