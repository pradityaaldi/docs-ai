import {
	Document,
	Packer,
	Paragraph,
	TextRun,
	HeadingLevel,
	AlignmentType,
	BorderStyle,
	Table,
	TableRow,
	TableCell,
	WidthType,
	ExternalHyperlink,
	ImageRun,
	PageBreak,
	TableOfContents
} from 'docx';
import { normalizeDoc, defaultTocLabel } from '../shared/toc';

interface DocxRun {
	text: string;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	strike?: boolean;
	color?: string;
	size?: number;
	font?: string;
	link?: string;
}

interface DocxElement {
	type: 'heading';
	level: 1 | 2 | 3 | 4 | 5;
	text?: string;
	runs?: DocxRun[];
	alignment?: 'left' | 'center' | 'right';
}

type DocxContent =
	| { type: 'heading'; level: 1 | 2 | 3 | 4 | 5; text?: string; runs?: DocxRun[]; alignment?: 'left' | 'center' | 'right' }
	| { type: 'paragraph'; text?: string; runs?: DocxRun[]; alignment?: 'left' | 'center' | 'right'; spacing?: number; spacingAfter?: number }
	| { type: 'bullet'; items: string[] }
	| { type: 'numbered'; items: string[] }
	| { type: 'table'; headers: string[]; rows: string[][]; alignments?: ('left' | 'center' | 'right')[] }
	| { type: 'hr' }
	| { type: 'code'; text: string; language?: string }
	| { type: 'quote'; text: string }
	| { type: 'image'; src: string; width?: number; height?: number; caption?: string }
	| { type: 'illustration'; html?: string; width?: number; height?: number; caption?: string }
	| { type: 'pageBreak' }
	| { type: 'toc'; label?: string };

interface DocxMeta {
	pageSize?: 'A4' | 'Letter' | 'Legal';
	orientation?: 'portrait' | 'landscape';
	marginTop?: number;
	marginRight?: number;
	marginBottom?: number;
	marginLeft?: number;
	font?: string;
	fontSize?: number;
	lineSpacing?: number;
}

interface DocxDocument {
	meta?: DocxMeta;
	content: DocxContent[];
}

const DEFAULT_META: Required<DocxMeta> = {
	pageSize: 'A4',
	orientation: 'portrait',
	marginTop: 1440,
	marginRight: 1440,
	marginBottom: 1440,
	marginLeft: 1440,
	font: 'Arial',
	fontSize: 22,
	lineSpacing: 276
};

const PAGE_SIZES: Record<string, { width: number; height: number }> = {
	A4: { width: 11906, height: 16838 },
	Letter: { width: 12240, height: 15840 },
	Legal: { width: 12240, height: 20160 }
};

function decodeImageSrc(src?: string): { type: 'png' | 'jpg' | 'gif' | 'bmp'; data: Buffer } | null {
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

function alignType(a?: string) {
	if (a === 'center') return AlignmentType.CENTER;
	if (a === 'right') return AlignmentType.RIGHT;
	return AlignmentType.LEFT;
}

function headingLevel(level: number) {
	switch (level) {
		case 2: return HeadingLevel.HEADING_2;
		case 3: return HeadingLevel.HEADING_3;
		case 4: return HeadingLevel.HEADING_4;
		case 5: return HeadingLevel.HEADING_5;
		default: return HeadingLevel.HEADING_1;
	}
}

function textToRuns(text: string, font: string, fontSize: number): DocxRun[] {
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

function buildRuns(runs: DocxRun[], font: string, fontSize: number): (TextRun | ExternalHyperlink)[] {
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

function resolveRuns(el: { text?: string; runs?: DocxRun[] }, font: string, fontSize: number): DocxRun[] {
	if (el.runs) return el.runs;
	if (el.text) return textToRuns(el.text, font, fontSize);
	return [{ text: '' }];
}

export function docxJsonToDocument(json: DocxDocument): Document {
	const meta = { ...DEFAULT_META, ...json.meta };
	const { font, fontSize, lineSpacing } = meta;

	const children: (Paragraph | Table)[] = [];

	for (const el of json.content) {
		switch (el.type) {
			case 'heading': {
				const runs = resolveRuns(el, font, fontSize);
				children.push(
					new Paragraph({
						children: buildRuns(runs, font, fontSize),
						heading: headingLevel(el.level),
						alignment: alignType(el.alignment),
						spacing: { before: 240, after: 120 }
					})
				);
				break;
			}
			case 'paragraph': {
				const runs = resolveRuns(el, font, fontSize);
				children.push(
					new Paragraph({
						children: buildRuns(runs, font, fontSize),
						alignment: alignType(el.alignment),
						spacing: { before: el.spacing ?? 120, after: el.spacingAfter ?? 120 }
					})
				);
				break;
			}
			case 'bullet': {
				for (const item of el.items) {
					children.push(
						new Paragraph({
							children: [new TextRun({ text: '•  ', font }), ...buildRuns(textToRuns(item, font, fontSize), font, fontSize)],
							spacing: { before: 40, after: 40 },
							indent: { left: 360 }
						})
					);
				}
				break;
			}
			case 'numbered': {
				for (let i = 0; i < el.items.length; i++) {
					children.push(
						new Paragraph({
							children: [new TextRun({ text: `${i + 1}.  `, font }), ...buildRuns(textToRuns(el.items[i], font, fontSize), font, fontSize)],
							spacing: { before: 40, after: 40 },
							indent: { left: 360 }
						})
					);
				}
				break;
			}
			case 'table': {
				const aligns = el.alignments ? el.alignments.map(alignType) : el.headers.map(() => AlignmentType.LEFT);
				const colCount = el.headers.length;
				const colWidth = Math.floor(100 / colCount);
				const cellBorders = {
					top: { style: BorderStyle.SINGLE, size: 1, color: 'd1d5db' },
					bottom: { style: BorderStyle.SINGLE, size: 1, color: 'd1d5db' },
					left: { style: BorderStyle.SINGLE, size: 1, color: 'd1d5db' },
					right: { style: BorderStyle.SINGLE, size: 1, color: 'd1d5db' }
				};

				const headerRow = new TableRow({
					children: el.headers.map((h, idx) =>
						new TableCell({
							children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, font, size: fontSize - 2 })], alignment: aligns[idx] })],
							width: { size: colWidth, type: WidthType.PERCENTAGE },
							shading: { type: 'solid', fill: 'f3f4f6' },
							borders: cellBorders
						})
					)
				});

				const dataRows = el.rows.map((row) =>
					new TableRow({
						children: el.headers.map((_, idx) =>
							new TableCell({
								children: [new Paragraph({ children: buildRuns(textToRuns(row[idx] || '', font, fontSize), font, fontSize), alignment: aligns[idx] })],
								width: { size: colWidth, type: WidthType.PERCENTAGE },
								borders: cellBorders
							})
						)
					})
				);

				children.push(
					new Table({
						rows: [headerRow, ...dataRows],
						borders: {
							top: { style: BorderStyle.SINGLE, size: 1, color: 'd1d5db' },
							bottom: { style: BorderStyle.SINGLE, size: 1, color: 'd1d5db' },
							left: { style: BorderStyle.SINGLE, size: 1, color: 'd1d5db' },
							right: { style: BorderStyle.SINGLE, size: 1, color: 'd1d5db' },
							insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'd1d5db' },
							insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'd1d5db' }
						}
					})
				);
				break;
			}
			case 'hr': {
				children.push(
					new Paragraph({
						border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999', space: 1 } },
						spacing: { before: 240, after: 240 }
					})
				);
				break;
			}
			case 'code': {
				children.push(
					new Paragraph({
						children: [new TextRun({ text: el.text, font: 'Courier New', size: fontSize - 2, color: '374151' })],
						shading: { type: 'solid', fill: 'f3f4f6' },
						spacing: { before: 120, after: 120 },
						indent: { left: 120, right: 120 }
					})
				);
				break;
			}
			case 'quote': {
				children.push(
					new Paragraph({
						children: buildRuns(textToRuns(el.text, font, fontSize), font, fontSize),
						border: { left: { style: BorderStyle.SINGLE, size: 12, color: '3b82f6', space: 8 } },
						indent: { left: 720 },
						spacing: { before: 120, after: 120 }
					})
				);
				break;
			}
			case 'image': {
				const decoded = decodeImageSrc(el.src);
				if (!decoded) break;
				const w = el.width ?? 480;
				const h = el.height ?? 320;
				children.push(
					new Paragraph({
						children: [new ImageRun({
							type: decoded.type,
							data: decoded.data,
							transformation: { width: w, height: h }
						} as any)],
						alignment: AlignmentType.CENTER,
						spacing: { before: 120, after: el.caption ? 40 : 120 }
					})
				);
				if (el.caption) {
					children.push(
						new Paragraph({
							children: [new TextRun({ text: el.caption, italics: true, color: '64748b', size: fontSize - 4, font })],
							alignment: AlignmentType.CENTER,
							spacing: { before: 0, after: 120 }
						})
					);
				}
				break;
			}
			case 'illustration': {
				children.push(
					new Paragraph({
						children: [new TextRun({ text: '[Illustration was not pre-rendered before export]', italics: true, color: '94a3b8', size: fontSize - 2, font })],
						alignment: AlignmentType.CENTER,
						spacing: { before: 120, after: 120 }
					})
				);
				break;
			}
			case 'pageBreak': {
				children.push(
					new Paragraph({
						children: [new PageBreak()]
					})
				);
				break;
			}
			case 'toc': {
				children.push(
					new Paragraph({
						text: el.label || defaultTocLabel(),
						heading: HeadingLevel.HEADING_2,
						spacing: { before: 360, after: 240 }
					})
				);
				children.push(
					new Paragraph({
						children: [
							new TableOfContents(el.label || defaultTocLabel(), {
								hyperlink: true,
								headingStyleRange: '2-5'
							})
						]
					})
				);
				break;
			}
		}
	}

	const pageSize = PAGE_SIZES[meta.pageSize] || PAGE_SIZES.A4;
	const [pageW, pageH] = meta.orientation === 'landscape' ? [pageSize.height, pageSize.width] : [pageSize.width, pageSize.height];

	return new Document({
		features: { updateFields: true },
		styles: {
			default: {
				document: {
					run: { font, size: fontSize }
				},
				heading1: {
					run: { font, size: 36, bold: true, color: '1e293b' }
				},
				heading2: {
					run: { font, size: 28, bold: true, color: '1e293b' }
				},
				heading3: {
					run: { font, size: 24, bold: true, color: '334155' }
				}
			}
		},
		sections: [{
			properties: {
				page: {
					size: { width: pageW, height: pageH },
					margin: {
						top: meta.marginTop,
						right: meta.marginRight,
						bottom: meta.marginBottom,
						left: meta.marginLeft
					}
				}
			},
			children
		}]
	});
}

export function parseDocxJson(input: string): DocxDocument | null {
	try {
		const parsed = JSON.parse(input);
		if (!parsed || !Array.isArray(parsed.content)) return null;
		return parsed as DocxDocument;
	} catch {
		return null;
	}
}

export async function generateDocxBuffer(docxJson: string): Promise<Buffer> {
	const doc = parseDocxJson(docxJson);
	if (!doc) throw new Error('Invalid docx JSON document');
	normalizeDoc(doc as { content: any[] });
	const document = docxJsonToDocument(doc);
	const buffer = await Packer.toBuffer(document);
	return Buffer.from(buffer);
}
