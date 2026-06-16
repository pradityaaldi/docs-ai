export interface DocxRun {
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

export type DocxContent =
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

export interface DocxMeta {
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

export interface DocxDocument {
	meta?: DocxMeta;
	content: DocxContent[];
}

export const DEFAULT_META: Required<DocxMeta> = {
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

export const PAGE_SIZES: Record<string, { width: number; height: number }> = {
	A4: { width: 11906, height: 16838 },
	Letter: { width: 12240, height: 15840 },
	Legal: { width: 12240, height: 20160 }
};
