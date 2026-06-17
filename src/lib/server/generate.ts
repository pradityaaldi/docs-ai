import { generateCompletion, type AIConnector, type Usage } from '$lib/server/ai';
import { parseDocumentBlocks, cleanJson } from '$lib/server/docx';
import type { Template, Project } from '$lib/server/db/schema';

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

// Shared output rules — keeps reasoning models (e.g. MiniMax M-series) from
// leaking <think> blocks and pushes richer structure for better DOCX quality.
const OUTPUT_RULES = `- Output HANYA JSON valid. JANGAN tulis prosa, code fence (\`\`\`), atau tag <think> apa pun.
- Mulai jawaban langsung dengan karakter { atau [ — tidak ada teks sebelum/sesudah JSON.
- Isi konten nyata, lengkap, substansial sesuai data user — BUKAN placeholder/lorem.
- Manfaatkan struktur kaya: heading bertingkat, paragraf yang mengalir, dan gunakan table/bullet/numbered bila menyajikan data, daftar, atau perbandingan.`;

export type ProgressFn = (e: Record<string, unknown>) => void;

// ── prompt builders (pure, reused by the tuning harness) ──

export interface Prompt {
	system: string;
	user: string;
}

export function buildSinglePrompt(tpl: Template, project: Project): Prompt {
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
- Bungkus dalam objek: { "content": [ ...blocks... ] }.
- JANGAN sertakan "meta" (sudah diatur sistem).
${OUTPUT_RULES}
- Untuk surat: tulis surat resmi lengkap (tempat/tanggal, tujuan, pembuka, isi, penutup, tanda tangan).`;

	const user = `Data user:\n${inputSummary(project.input as any)}\n\nBuat dokumen lengkap sekarang.`;
	return { system, user };
}

function sectionCtx(tpl: Template, project: Project): string {
	return `Judul: ${(project.input as any)?.judul || project.name}
Data user:
${inputSummary(project.input as any)}
Kampus: ${tpl.kampus || '-'}
Bahasa: ${project.bahasa}`;
}

export function buildSectionPrompt(
	tpl: Template,
	project: Project,
	sec: { section: string; sub?: string[] }
): Prompt {
	const isBab = /^BAB/i.test(sec.section);
	const system = `Kamu penulis skripsi akademik. Tulis SATU bagian skripsi: "${sec.section}".
${sec.sub?.length ? `Subbagian: ${sec.sub.join(', ')}.` : ''}
Bahasa: ${project.bahasa}.

${BLOCK_REF}

ATURAN:
- Output berupa array JSON berisi blocks untuk bagian ini saja.
- ${isBab ? 'Mulai dengan heading level 1 untuk judul BAB, heading level 2 untuk subbagian.' : 'Gunakan heading level 1 untuk judul bagian ini.'}
${OUTPUT_RULES}
- Tulis beberapa paragraf per subbagian — akademik, mengalir, substansial.
- Untuk "Daftar Pustaka": minimal 8 referensi gaya APA sebagai numbered/paragraph.`;

	const user = `Konteks:\n${sectionCtx(tpl, project)}\n\nTulis bagian "${sec.section}" sekarang.`;
	return { system, user };
}

// ── single-shot for short docs (makalah / surat) ──

async function generateSingle(
	tpl: Template,
	project: Project,
	connector: AIConnector,
	signal: AbortSignal | undefined,
	onProgress: ProgressFn
): Promise<{ content: any[]; usage: Usage }> {
	const { system, user } = buildSinglePrompt(tpl, project);

	onProgress({ type: 'section', name: tpl.name, index: 0, total: 1 });
	const { text, usage } = await generateCompletion(connector, [{ role: 'user', content: user }], system, signal, 16384);

	const res = parseDocumentBlocks(text);
	if (res.warnings.length) onProgress({ type: 'parse_warn', name: tpl.name, warnings: res.warnings });
	const content = res.ok && res.content.length ? res.content : [{ type: 'paragraph', text: cleanJson(text) }];
	return { content, usage };
}

// ── section-by-section for long docs (skripsi) ──

async function generateSectioned(
	tpl: Template,
	project: Project,
	connector: AIConnector,
	signal: AbortSignal | undefined,
	onProgress: ProgressFn
): Promise<{ content: any[]; usage: Usage }> {
	const struktur = tpl.struktur as Array<{ section: string; sub?: string[] }>;
	const total = struktur.length;
	const all: any[] = [];
	const usage: Usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

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
		const { system, user } = buildSectionPrompt(tpl, project, sec);

		try {
			const { text, usage: u } = await generateCompletion(connector, [{ role: 'user', content: user }], system, signal, 8192);
			usage.promptTokens += u.promptTokens;
			usage.completionTokens += u.completionTokens;
			usage.totalTokens += u.totalTokens;

			const res = parseDocumentBlocks(text);
			if (res.warnings.length) onProgress({ type: 'parse_warn', name: sec.section, warnings: res.warnings });
			const blocks = res.ok && res.content.length ? res.content : [{ type: 'paragraph', text: cleanJson(text) }];
			if (isBab && all.length > 0) all.push({ type: 'pageBreak' });
			all.push(...blocks);
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
			? await generateSectioned(tpl, project, connector, signal, onProgress)
			: await generateSingle(tpl, project, connector, signal, onProgress);

	const doc = { meta, content };
	return { docJson: JSON.stringify(doc), usage };
}
