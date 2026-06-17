import { Document, Packer, Paragraph, Table } from 'docx';
import { normalizeDoc } from '../../shared/toc';
import { DEFAULT_META, PAGE_SIZES, type DocxDocument } from './types';
import { renderElement } from './elements';

export type { DocxDocument, DocxContent, DocxMeta, DocxRun } from './types';
export { parseDocumentBlocks, validateBlocks, extractJson, cleanJson, type ParseResult } from './parse';

export function docxJsonToDocument(json: DocxDocument): Document {
	const meta = { ...DEFAULT_META, ...json.meta };
	const { font, fontSize } = meta;

	const children: (Paragraph | Table)[] = [];
	for (const el of json.content) {
		children.push(...renderElement(el, font, fontSize));
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
