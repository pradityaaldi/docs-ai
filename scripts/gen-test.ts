/**
 * Document-generation tuning harness.
 *
 * Runs the REAL generation pipeline (same prompts + parser + DOCX renderer used
 * in production) against a configured AI provider, then prints a quality report
 * and writes a .docx so you can eyeball the output. Use it to tune prompts and
 * verify a provider/model (e.g. MiniMax M3) before wiring it into the admin UI.
 *
 * Usage:
 *   MINIMAX_KEY=sk-... bun run scripts/gen-test.ts [template-slug]
 *
 * Env:
 *   MINIMAX_KEY (or AI_KEY)  required — API key
 *   AI_PROVIDER  default "minimax"
 *   AI_BASE      default "https://api.minimax.io/v1"
 *   AI_MODEL     default "MiniMax-M3"
 */
import { generateProjectDocument } from '../src/lib/server/generate';
import { generateDocxBuffer, parseDocumentBlocks } from '../src/lib/server/docx';
import { TEMPLATE_SEEDS } from '../src/lib/server/templates-seed';
import type { AIConnector } from '../src/lib/server/ai';

const KEY = process.env.MINIMAX_KEY || process.env.AI_KEY;
if (!KEY) {
	console.error('Set MINIMAX_KEY (or AI_KEY). Aborting.');
	process.exit(1);
}

const connector: AIConnector = {
	id: 'test',
	name: 'test',
	provider: (process.env.AI_PROVIDER || 'minimax') as AIConnector['provider'],
	base_url: process.env.AI_BASE || 'https://api.minimax.io/v1',
	model_name: process.env.AI_MODEL || 'MiniMax-M3',
	api_key: KEY,
	is_active: 1
};

// Pick template: arg slug, else first non-skripsi (single-shot = fast/cheap).
const slug = process.argv[2];
const tpl: any =
	(slug && TEMPLATE_SEEDS.find((t: any) => t.slug === slug)) ||
	TEMPLATE_SEEDS.find((t: any) => t.category !== 'skripsi') ||
	TEMPLATE_SEEDS[0];

if (!tpl) {
	console.error('No template found in TEMPLATE_SEEDS.');
	process.exit(1);
}

// Sample form input from the template's declared fields.
const SAMPLE: Record<string, string> = {
	judul: 'Dampak Kecerdasan Buatan terhadap Produktivitas UMKM di Indonesia',
	nama: 'Budi Santoso',
	nim: '21/123456/PA/12345',
	jurusan: 'Ilmu Komputer',
	fakultas: 'MIPA',
	tahun: '2026',
	bahasa: 'Indonesia'
};
const input: Record<string, string> = {};
for (const f of (tpl.formFields as any[]) || []) {
	input[f.key] = SAMPLE[f.key] ?? `Contoh ${f.label || f.key}`;
}
input.judul ??= SAMPLE.judul;

const project: any = { name: tpl.name, bahasa: 'Indonesia', input };

const warns: any[] = [];
const sections: string[] = [];
function onProgress(e: Record<string, unknown>) {
	if (e.type === 'section') sections.push(String(e.name));
	if (e.type === 'parse_warn') warns.push(e);
	if (e.type === 'section_error') console.error('  section_error:', e.name, e.error);
}

console.log(`\n▶ Provider: ${connector.provider} · Model: ${connector.model_name} · Base: ${connector.base_url}`);
console.log(`▶ Template: ${tpl.name} (${tpl.category}) · slug=${tpl.slug}\n`);

const t0 = Date.now();
const { docJson, usage } = await generateProjectDocument(tpl, project, connector, undefined, onProgress);
const ms = Date.now() - t0;

// Quality report
const doc = JSON.parse(docJson);
const blocks: any[] = doc.content || [];
const hist: Record<string, number> = {};
for (const b of blocks) hist[b.type] = (hist[b.type] || 0) + 1;
const reasoningLeak = /<think|<\/think/i.test(docJson);

console.log('── QUALITY REPORT ──────────────────────────────');
console.log('latency        :', ms, 'ms');
console.log('tokens         :', usage.totalTokens, `(prompt ${usage.promptTokens} / completion ${usage.completionTokens})`);
console.log('sections run   :', sections.length, sections.length > 6 ? `(${sections.slice(0, 6).join(', ')}, …)` : `(${sections.join(', ')})`);
console.log('blocks         :', blocks.length);
console.log('block types    :', JSON.stringify(hist));
console.log('parse warnings :', warns.length ? JSON.stringify(warns) : 'none');
console.log('reasoning leak :', reasoningLeak ? '!! <think> FOUND IN OUTPUT' : 'none (clean)');

// Re-validate the produced content as a sanity check on the parser.
const reparse = parseDocumentBlocks(docJson);
console.log('reparse ok     :', reparse.ok, `(kept ${reparse.content.length}/${blocks.length} blocks)`);

// Render to DOCX to prove it survives the full export path.
let docxNote = '';
try {
	const buf = await generateDocxBuffer(docJson);
	const out = `scripts/test-output-${tpl.slug}.docx`;
	await Bun.write(out, buf);
	docxNote = `${(buf.length / 1024).toFixed(1)} KB → ${out}`;
} catch (e) {
	docxNote = `RENDER FAILED: ${(e as Error).message}`;
}
console.log('docx render    :', docxNote);

console.log('\n── DOCUMENT PREVIEW (first 6 blocks) ───────────');
for (const b of blocks.slice(0, 6)) {
	const txt = b.text || (b.items ? b.items.join(' | ') : b.headers ? `[table ${b.headers.join('/')}]` : b.label || '');
	console.log(`  ${b.type}${b.level ? ` h${b.level}` : ''}: ${String(txt).slice(0, 90)}`);
}
console.log('');
