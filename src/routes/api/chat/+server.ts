import { streamAIResponse } from '$lib/server/ai';
import getDb from '$lib/server/db';
import type { RequestHandler } from './$types';

function plainText(text: string): string {
	let s = text.replace(/<think>[\s\S]*?<\/think>/g, '');
	s = s.replace(/<think>[\s\S]*$/, '');
	return s;
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

	const systemPrompt = `You are a helpful document writing assistant who ONLY acknowledges requests. You are a conversation partner — NOT the document generator. A separate automated system handles all document creation.

Current document title: "${document.title}"
${document.content ? 'The document already has content. The user may ask about it.' : 'No document content yet.'}

CRITICAL RULES:
- ONLY respond with 1-3 brief sentences acknowledging what you'll do. That's it. Nothing more.
- Example: "Sure, I'll create a short business proposal for your tech startup. Give me a moment."
- Example: "Got it, let me update the marketing section with a more persuasive tone."
- NEVER output document content, outlines, drafts, sections, or any part of the actual document.
- NEVER use markdown headings, bullet lists, or formatting — you're just chatting.
- DO NOT write "Here's the proposal:", "Here's a draft:", "Version:", or anything similar.
- When in doubt, just say "I'll handle that for you. The document will appear on the right."`;

	const chatMessages = history.map((m) => {
		let content = m.content;
		if (m.role === 'assistant') {
			const stripped = content.replace(/<think>[\s\S]*?<\/think>/g, '');
			const braceIdx = stripped.indexOf('{');
			if (braceIdx >= 0) {
				try {
					const parsed = JSON.parse(stripped.slice(braceIdx));
					if (parsed && parsed.meta && parsed.content) {
						content = '[Document generated — see preview panel]';
					}
				} catch {}
			}
		}
		return { role: m.role as 'user' | 'assistant', content };
	});

	const t0 = Date.now();
	const signal = request.signal;
	let fullResponse = '';

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
					console.log(`[CHAT] calling upstream +${Date.now() - t0}ms`);
					const upstream = await streamAIResponse(connector, chatMessages, systemPrompt, signal);
					console.log(`[CHAT] upstream headers +${Date.now() - t0}ms`);
					const reader = upstream.getReader();

					while (true) {
						if (signal.aborted) {
							reader.cancel().catch(() => {});
							break;
						}
						const { done, value } = await reader.read();
						if (done) break;
						const text = decoder.decode(value, { stream: true });
						fullResponse += text;
						try { controller.enqueue(value); } catch { break; }
					}
					fullResponse += decoder.decode();

					const cleaned = plainText(fullResponse).trim();
					console.log(`[CHAT] flush rawLen=${fullResponse.length} cleanLen=${cleaned.length} aborted=${signal.aborted} elapsed=${Date.now() - t0}ms`);
					if (cleaned && !signal.aborted) {
						const assistantMsgId = crypto.randomUUID();
						db.prepare(`INSERT INTO messages (id, document_id, role, content) VALUES (?, ?, 'assistant', ?)`)
							.run(assistantMsgId, document_id, cleaned);
						db.prepare(`UPDATE documents SET updated_at = datetime('now') WHERE id = ?`)
							.run(document_id);
					}
				} catch (e: any) {
					console.error(`[CHAT] upstream error +${Date.now() - t0}ms`, e?.message || e);
					try {
						controller.enqueue(encoder.encode(`\n__ERROR__:${e?.message || String(e)}`));
					} catch {}
				} finally {
					closed = true;
					clearInterval(hbTimer);
					try { controller.close(); } catch {}
				}
			})();
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
