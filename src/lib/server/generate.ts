import { generateCompletion, type AIConnector, type Usage } from '$lib/server/ai';
import type { Template, Project } from '$lib/server/db/schema';

// ── helpers ──

export function cleanJson(raw: string): string {
	let s = raw.replace(/<think>[\s\S]*?<\/think>/g, '');
	s = s.replace(/<think>[\s\S]*$/, '');
	s = s.replace(/```(?:json)?\s*/gi, '');
	s = s.replace(/```\s*$/g, '');
	return s.trim();
}

function sliceObject(raw: string): string {
	const s = cleanJson(raw);
	const a = s.indexOf('{');
	const b = s.lastIndexOf('}');
	return a >= 0 && b > a ? s.slice(a, b + 1) : s;
}

function sliceArray(raw: string): string {
	const s = cleanJson(raw);
	const a = s.indexOf('[');
	const b = s.lastIndexOf(']');
	return a >= 0 && b > a ? s.slice(a, b + 1) : s;
}

export interface DocMeta {
	pageSize: string;
	orientation: string;
	marginTop: number;
	marginRight: number;
	marginBottom: number;
	marginLeft: number;
	font: string;
	fontSize: number;
	lineSpacing: number;
}

export function metaFromFormat(format: any): DocMeta {
	const f = format || {};
	return {
		pageSize: f.pageSize || 'A4',
		orientation: f.orientation || 'portrait',
		marginTop: f.marginTop ?? 1440,
		marginRight: f.marginRight ?? 1440,
		marginBottom: f.marginBottom ?? 1440,
		marginLeft: f.marginLeft ?? 1440,
		font: f.font || 'Times New Roman',
		fontSize: f.fontSize ?? 24,
		lineSpacing: f.lineSpacing ?? 360
	};
}

function inputSummary(input: Record<string, any> | null | undefined): string {
	if (!input) return '(tidak ada)';
	return Object.entries(input)
		.filter(([, v]) => v !== '' && v != null)
		.map(([k, v]) => `- ${k}: ${v}`)
		.join('\n');
}

const BLOCK_REF = `Block types yang boleh dipakai (DOCX JSON):
- { "type": "heading", "level": 1-4, "text": "..." }
- { "type": "paragraph", "text": "teks dengan **bold**, *italic*" }  (boleh "alignment": "center"|"right"|"justify")
- { "type": "bullet", "items": ["...", "..."] }
- { "type": "numbered", "items": ["...", "..."] }
- { "type": "table", "headers": ["A","B"], "rows": [["1","2"]] }
- { "type": "quote", "text": "..." }
- { "type": "hr" }
- { "type": "pageBreak" }
- { "type": "toc", "label": "Daftar Isi" }`;

export type ProgressFn = (e: Record<string, unknown>) => void;

// ── single-shot for short docs (makalah / surat) ──

async function generateSingle(
	tpl: Template,
	project: Project,
	connector: AIConnector,
	meta: DocMeta,
	signal: AbortSignal | undefined,
	onProgress: ProgressFn
): Promise<{ content: any[]; usage: Usage }> {
	const struktur = tpl.struktur as Array<{ section: string; sub?: string[] }>;
	const strukturText = struktur
		.map((s) => `- ${s.section}${s.sub?.length ? ` (${s.sub.join(', ')})` : ''}`)
		.join('\n');

	const system = `Kamu generator dokumen profesional. Hasilkan dokumen "${tpl.name}" dalam format DOCX JSON.
Bahasa dokumen: ${project.bahasa}.

Ikuti struktur ini:
${strukturText}

${BLOCK_REF}

ATURAN:
- Output HANYA objek JSON valid: { "content": [ ...blocks... ] }. Tanpa prosa, tanpa code fence, tanpa <think>.
- JANGAN sertakan "meta" (sudah diatur sistem).
- Isi konten nyata, lengkap, sesuai data user — bukan placeholder.
- Untuk surat: tulis surat resmi lengkap (tempat/tanggal, tujuan, pembuka, isi, penutup, tanda tangan).`;

	const user = `Data user:\n${inputSummary(project.input as any)}\n\nBuat dokumen lengkap sekarang.`;

	onProgress({ type: 'section', name: tpl.name, index: 0, total: 1 });
	const { text, usage } = await generateCompletion(connector, [{ role: 'user', content: user }], system, signal, 16384);

	let content: any[] = [];
	try {
		const parsed = JSON.parse(sliceObject(text));
		content = Array.isArray(parsed.content) ? parsed.content : Array.isArray(parsed) ? parsed : [];
	} catch {
		content = [{ type: 'paragraph', text: cleanJson(text) }];
	}
	return { content, usage };
}

// ── section-by-section for long docs (skripsi) ──

async function generateSectioned(
	tpl: Template,
	project: Project,
	connector: AIConnector,
	meta: DocMeta,
	signal: AbortSignal | undefined,
	onProgress: ProgressFn
): Promise<{ content: any[]; usage: Usage }> {
	const struktur = tpl.struktur as Array<{ section: string; sub?: string[] }>;
	const total = struktur.length;
	const all: any[] = [];
	const usage: Usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

	const ctx = `Judul: ${(project.input as any)?.judul || project.name}
Data user:
${inputSummary(project.input as any)}
Kampus: ${tpl.kampus || '-'}
Bahasa: ${project.bahasa}`;

	for (let i = 0; i < struktur.length; i++) {
		if (signal?.aborted) break;
		const sec = struktur[i];
		onProgress({ type: 'section', name: sec.section, index: i, total });

		// Daftar Isi → inject a toc block, no AI needed
		if (/daftar isi/i.test(sec.section)) {
			all.push({ type: 'pageBreak' });
			all.push({ type: 'toc', label: project.bahasa === 'English' ? 'Table of Contents' : 'Daftar Isi' });
			continue;
		}

		const isBab = /^BAB/i.test(sec.section);
		const system = `Kamu penulis skripsi akademik. Tulis SATU bagian skripsi: "${sec.section}".
${sec.sub?.length ? `Subbagian: ${sec.sub.join(', ')}.` : ''}
Bahasa: ${project.bahasa}.

${BLOCK_REF}

ATURAN:
- Output HANYA array JSON berisi blocks untuk bagian ini. Tanpa prosa/fence/<think>.
- ${isBab ? 'Mulai dengan heading level 1 untuk judul BAB, heading level 2 untuk subbagian.' : 'Gunakan heading level 1 untuk judul bagian ini.'}
- Tulis konten akademik nyata, mengalir, dan substansial (beberapa paragraf per subbagian). Bukan placeholder.
- Untuk "Daftar Pustaka": buat minimal 8 referensi gaya APA sebagai numbered/paragraph.`;

		const user = `Konteks:\n${ctx}\n\nTulis bagian "${sec.section}" sekarang.`;

		try {
			const { text, usage: u } = await generateCompletion(connector, [{ role: 'user', content: user }], system, signal, 8192);
			usage.promptTokens += u.promptTokens;
			usage.completionTokens += u.completionTokens;
			usage.totalTokens += u.totalTokens;

			let blocks: any[] = [];
			try {
				blocks = JSON.parse(sliceArray(text));
			} catch {
				blocks = [{ type: 'paragraph', text: cleanJson(text) }];
			}
			if (isBab && all.length > 0) all.push({ type: 'pageBreak' });
			all.push(...(Array.isArray(blocks) ? blocks : []));
		} catch (e) {
			onProgress({ type: 'section_error', name: sec.section, error: (e as Error).message });
			if (signal?.aborted) break;
		}
	}

	return { content: all, usage };
}

// ── public ──

export async function generateProjectDocument(
	tpl: Template,
	project: Project,
	connector: AIConnector,
	signal: AbortSignal | undefined,
	onProgress: ProgressFn
): Promise<{ docJson: string; usage: Usage }> {
	const meta = metaFromFormat(tpl.format);
	const { content, usage } =
		tpl.category === 'skripsi'
			? await generateSectioned(tpl, project, connector, meta, signal, onProgress)
			: await generateSingle(tpl, project, connector, meta, signal, onProgress);

	const doc = { meta, content };
	return { docJson: JSON.stringify(doc), usage };
}
