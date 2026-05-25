import { streamAIResponse } from '$lib/server/ai';
import getDb from '$lib/server/db';
import type { RequestHandler } from './$types';

function stripThinkingBlocks(text: string): string {
	let result = text.replace(/<think>[\s\S]*?<\/think>/g, '');
	result = result.replace(/<think>[\s\S]*$/, '');
	result = result.replace(/```(?:json)?\s*/gi, '');
	result = result.replace(/```\s*$/g, '');
	const braceIdx = result.indexOf('{');
	if (braceIdx > 0) result = result.slice(braceIdx);
	const lastBrace = result.lastIndexOf('}');
	if (lastBrace > 0 && lastBrace < result.length - 1) {
		result = result.slice(0, lastBrace + 1);
	}
	return result.trim();
}

export const POST: RequestHandler = async ({ request }) => {
	const { document_id, message } = await request.json();

	if (!document_id) {
		return new Response(JSON.stringify({ error: 'Missing document_id' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const db = getDb();

	const connector = db.prepare('SELECT * FROM connectors WHERE is_active = 1').get() as any;
	if (!connector) {
		return new Response(JSON.stringify({ error: 'No active AI connector' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(document_id) as any;
	if (!document) {
		return new Response(JSON.stringify({ error: 'Document not found' }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const history = db.prepare('SELECT role, content FROM messages WHERE document_id = ? ORDER BY created_at ASC')
		.all(document_id) as { role: string; content: string }[];

	const systemPrompt = `You are a professional document generator. Based on the conversation history, generate the document as DOCX JSON — a structured JSON format that maps directly to Word document elements.

IMPORTANT: Output ONLY valid JSON — no conversational text, no markdown, no code fences. Just the raw JSON object.

The JSON must follow this exact structure:
{
  "meta": {
    "pageSize": "A4",
    "orientation": "portrait",
    "marginTop": 1440,
    "marginRight": 1440,
    "marginBottom": 1440,
    "marginLeft": 1440,
    "font": "Arial",
    "fontSize": 22,
    "lineSpacing": 276
  },
  "content": [
    { "type": "heading", "level": 1, "text": "Document Title" },
    { "type": "heading", "level": 2, "text": "Section" },
    { "type": "paragraph", "text": "Text with **bold** and *italic*." },
    { "type": "paragraph", "text": "Centered text", "alignment": "center" },
    { "type": "paragraph", "runs": [
      { "text": "Bold", "bold": true },
      { "text": " normal text " },
      { "text": "red", "color": "dc2626" },
      { "text": "link", "link": "https://example.com" }
    ]},
    { "type": "bullet", "items": ["Item one", "Item two"] },
    { "type": "numbered", "items": ["Step one", "Step two"] },
    { "type": "table", "headers": ["Col A", "Col B"], "rows": [["A1", "B1"], ["A2", "B2"]] },
    { "type": "hr" },
    { "type": "code", "text": "console.log('hello');" },
    { "type": "quote", "text": "Important callout" },
    { "type": "pageBreak" },
    { "type": "toc", "label": "Daftar Isi" }
  ]
}

Rules:
- Always include "meta" with page size, orientation, margins, and font
- Start with heading level 1 as the document title
- Use heading level 2 for major sections, level 3 for subsections
- TOC tooling: emit a single { "type": "toc", "label": "..." } block — the renderer auto-fills entries
  from all subsequent headings (level 2-4) until the next toc/pageBreak or end of document. Do NOT
  hand-write a list of section titles as bullets/paragraphs to fake a TOC. Optional fields:
    - "items": [{ "text": "...", "level": 2 }] to override auto-fill with custom entries
    - "minLevel" / "maxLevel": number to widen/narrow the heading range
  Localize "label" to match the document language (e.g. "Daftar Isi", "Table of Contents", "目次").
- "runs" gives precise per-character control: bold, italic, underline, strike, color, size, font, link
- In "text" fields, use **bold**, *italic*, \`code\`, [link](url) inline shortcuts
- Use "table" for structured data; add "alignments" array if needed
- Be thorough and detailed — real business content, not placeholders
- NEVER wrap output in <think> tags or code fences — output ONLY the raw JSON

Document title: "${document.title}"

Conversation history is provided below. Generate the complete document based on the user's last request and the full context.`;

	const chatMessages = history.map((m) => ({
		role: m.role as 'user' | 'assistant',
		content: m.content
	}));

	if (message && !chatMessages.some((m) => m.role === 'user' && m.content === message)) {
		chatMessages.push({ role: 'user', content: message });
	}

	const t0 = Date.now();
	console.log(`[GEN] start doc=${document_id} provider=${connector.provider} model=${connector.model_name}`);

	const signal = request.signal;
	let fullResponse = '';
	let lastSavedLen = 0;
	let lastSaveAt = 0;

	const saveIfNeeded = (force: boolean) => {
		const now = Date.now();
		if (!force && (fullResponse.length - lastSavedLen < 200 || now - lastSaveAt < 2000)) return;
		const cleaned = stripThinkingBlocks(fullResponse);
		if (!cleaned) return;
		try {
			db.prepare(`UPDATE documents SET content = ?, updated_at = datetime('now') WHERE id = ?`)
				.run(cleaned, document_id);
			lastSavedLen = fullResponse.length;
			lastSaveAt = now;
		} catch (e) {
			console.error('[GEN] save error', e);
		}
	};

	const wireStream = new ReadableStream<Uint8Array>({
		start(controller) {
			const encoder = new TextEncoder();
			const decoder = new TextDecoder();
			let closed = false;

			const hbTimer = setInterval(() => {
				if (closed) return;
				try { controller.enqueue(encoder.encode(' ')); } catch { closed = true; }
			}, 3000);

			try { controller.enqueue(encoder.encode(' ')); } catch {}

			(async () => {
				try {
					console.log(`[GEN] calling upstream +${Date.now() - t0}ms`);
					const upstream = await streamAIResponse(connector, chatMessages, systemPrompt, signal);
					console.log(`[GEN] upstream headers received +${Date.now() - t0}ms`);
					const reader = upstream.getReader();

					while (true) {
						if (signal.aborted) {
							console.log(`[GEN] client aborted +${Date.now() - t0}ms`);
							reader.cancel().catch(() => {});
							break;
						}
						const { done, value } = await reader.read();
						if (done) break;
						const text = decoder.decode(value, { stream: true });
						fullResponse += text;
						try { controller.enqueue(value); } catch { break; }
						saveIfNeeded(false);
					}
					fullResponse += decoder.decode();
					console.log(`[GEN] stream done len=${fullResponse.length} elapsed=${Date.now() - t0}ms`);
					saveIfNeeded(true);
				} catch (e: any) {
					console.error(`[GEN] upstream error +${Date.now() - t0}ms`, e?.message || e);
					try {
						controller.enqueue(encoder.encode(`\n__ERROR__:${e?.message || String(e)}`));
					} catch {}
				} finally {
					closed = true;
					clearInterval(hbTimer);
					try { controller.close(); } catch {}
				}
			})();
		},
		cancel() {
			console.log(`[GEN] wire cancelled +${Date.now() - t0}ms`);
		}
	});

	return new Response(wireStream, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no'
		}
	});
};
