import {
	Paragraph,
	TextRun,
	HeadingLevel,
	AlignmentType,
	BorderStyle,
	Table,
	TableRow,
	TableCell,
	WidthType,
	ImageRun,
	PageBreak,
	TableOfContents
} from 'docx';
import { defaultTocLabel } from '../../shared/toc';
import type { DocxContent } from './types';
import { decodeImageSrc, alignType, headingLevel, textToRuns, buildRuns, resolveRuns } from './runs';

/**
 * Render a single document element to its docx block(s). Pure: returns a list of
 * Paragraph/Table nodes, leaving assembly (page/section/styles) to the caller.
 */
export function renderElement(el: DocxContent, font: string, fontSize: number): (Paragraph | Table)[] {
	switch (el.type) {
		case 'heading': {
			const runs = resolveRuns(el, font, fontSize);
			return [
				new Paragraph({
					children: buildRuns(runs, font, fontSize),
					heading: headingLevel(el.level),
					alignment: alignType(el.alignment),
					spacing: { before: 240, after: 120 }
				})
			];
		}
		case 'paragraph': {
			const runs = resolveRuns(el, font, fontSize);
			return [
				new Paragraph({
					children: buildRuns(runs, font, fontSize),
					alignment: alignType(el.alignment),
					spacing: { before: el.spacing ?? 120, after: el.spacingAfter ?? 120 }
				})
			];
		}
		case 'bullet': {
			return el.items.map((item) =>
				new Paragraph({
					children: [new TextRun({ text: '•  ', font }), ...buildRuns(textToRuns(item, font, fontSize), font, fontSize)],
					spacing: { before: 40, after: 40 },
					indent: { left: 360 }
				})
			);
		}
		case 'numbered': {
			return el.items.map((item, i) =>
				new Paragraph({
					children: [new TextRun({ text: `${i + 1}.  `, font }), ...buildRuns(textToRuns(item, font, fontSize), font, fontSize)],
					spacing: { before: 40, after: 40 },
					indent: { left: 360 }
				})
			);
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

			return [
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
			];
		}
		case 'hr': {
			return [
				new Paragraph({
					border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999', space: 1 } },
					spacing: { before: 240, after: 240 }
				})
			];
		}
		case 'code': {
			return [
				new Paragraph({
					children: [new TextRun({ text: el.text, font: 'Courier New', size: fontSize - 2, color: '374151' })],
					shading: { type: 'solid', fill: 'f3f4f6' },
					spacing: { before: 120, after: 120 },
					indent: { left: 120, right: 120 }
				})
			];
		}
		case 'quote': {
			return [
				new Paragraph({
					children: buildRuns(textToRuns(el.text, font, fontSize), font, fontSize),
					border: { left: { style: BorderStyle.SINGLE, size: 12, color: '3b82f6', space: 8 } },
					indent: { left: 720 },
					spacing: { before: 120, after: 120 }
				})
			];
		}
		case 'image': {
			const decoded = decodeImageSrc(el.src);
			if (!decoded) return [];
			const w = el.width ?? 480;
			const h = el.height ?? 320;
			const out: Paragraph[] = [
				new Paragraph({
					children: [new ImageRun({
						type: decoded.type,
						data: decoded.data,
						transformation: { width: w, height: h }
					} as any)],
					alignment: AlignmentType.CENTER,
					spacing: { before: 120, after: el.caption ? 40 : 120 }
				})
			];
			if (el.caption) {
				out.push(
					new Paragraph({
						children: [new TextRun({ text: el.caption, italics: true, color: '64748b', size: fontSize - 4, font })],
						alignment: AlignmentType.CENTER,
						spacing: { before: 0, after: 120 }
					})
				);
			}
			return out;
		}
		case 'illustration': {
			return [
				new Paragraph({
					children: [new TextRun({ text: '[Illustration was not pre-rendered before export]', italics: true, color: '94a3b8', size: fontSize - 2, font })],
					alignment: AlignmentType.CENTER,
					spacing: { before: 120, after: 120 }
				})
			];
		}
		case 'pageBreak': {
			return [new Paragraph({ children: [new PageBreak()] })];
		}
		case 'toc': {
			return [
				new Paragraph({
					text: el.label || defaultTocLabel(),
					heading: HeadingLevel.HEADING_2,
					spacing: { before: 360, after: 240 }
				}),
				new Paragraph({
					children: [
						new TableOfContents(el.label || defaultTocLabel(), {
							hyperlink: true,
							headingStyleRange: '2-5'
						})
					]
				})
			];
		}
		default:
			return [];
	}
}
