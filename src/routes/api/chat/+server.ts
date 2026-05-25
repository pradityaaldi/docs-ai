import { streamAIResponse } from '$lib/server/ai';
import getDb from '$lib/server/db';
import type { RequestHandler } from './$types';

function stripThinkingBlocks(text: string): string {
	let result = text.replace(/<think>[\s\S]*?<\/think>/g, '');
	const braceIdx = result.indexOf('{');
	if (braceIdx > 0) result = result.slice(braceIdx);
	return result;
}

export const POST: RequestHandler = async ({ request }) => {
	const { document_id, message } = await request.json();

	if (!document_id || !message) {
		return new Response(JSON.stringify({ error: 'Missing document_id or message' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const db = getDb();

	const connector = db.prepare('SELECT * FROM connectors WHERE is_active = 1').get() as any;
	if (!connector) {
		return new Response(JSON.stringify({ error: 'No active AI connector. Please configure one in settings.' }), {
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

	const userMsgId = crypto.randomUUID();
	db.prepare(`INSERT INTO messages (id, document_id, role, content) VALUES (?, ?, 'user', ?)`)
		.run(userMsgId, document_id, message);

	const history = db.prepare('SELECT role, content FROM messages WHERE document_id = ? ORDER BY created_at ASC')
		.all(document_id) as { role: string; content: string }[];

	const systemPrompt = `You are a professional document generator. You output documents as DOCX JSON — a structured JSON format that maps directly to Word document elements.

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
    { "type": "toc", "label": "Table of Contents" }
  ]
}

Rules:
- Always include "meta" with page size, orientation, margins, and font
- Start with heading level 1 as the document title
- Use heading level 2 for major sections, level 3 for subsections
- Use "toc" after the title for table of contents when appropriate
- "runs" gives precise per-character control: bold, italic, underline, strike, color, size, font, link
- In "text" fields, use **bold**, *italic*, \`code\`, [link](url) inline shortcuts
- Use "table" for structured data; add "alignments" array if needed
- Be thorough and detailed — real business content, not placeholders
- When asked to modify, output the COMPLETE updated JSON
- NEVER wrap output in <think> tags or code fences — output ONLY the raw JSON

Current document title: "${document.title}"
${document.content ? `Current document content:\n${document.content}\n\nPlease modify or continue based on the user's request.` : 'This is a new document. Please create a complete document based on the user\'s request.'}`;

	const chatMessages = history.map((m) => ({
		role: m.role as 'user' | 'assistant',
		content: m.content
	}));

	try {
		const stream = await streamAIResponse(connector, chatMessages, systemPrompt);

		let fullResponse = '';
		const decoder = new TextDecoder();
		const signal = request.signal;
		const transformStream = new TransformStream({
			transform(chunk, controller) {
				const text = decoder.decode(chunk, { stream: true });
				fullResponse += text;
				controller.enqueue(chunk);
			},
			flush() {
				const remaining = decoder.decode();
				fullResponse += remaining;
				const cleaned = stripThinkingBlocks(fullResponse);
				if (cleaned && !signal.aborted) {
					const assistantMsgId = crypto.randomUUID();
					db.prepare(`INSERT INTO messages (id, document_id, role, content) VALUES (?, ?, 'assistant', ?)`)
						.run(assistantMsgId, document_id, cleaned);
					db.prepare(`UPDATE documents SET content = ?, updated_at = datetime('now') WHERE id = ?`)
						.run(cleaned, document_id);
				}
			}
		});

		const transformedStream = stream.pipeThrough(transformStream);

		return new Response(transformedStream, {
			headers: {
				'Content-Type': 'text/plain; charset=utf-8',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive'
			}
		});
	} catch (err: any) {
		return new Response(JSON.stringify({ error: err.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
