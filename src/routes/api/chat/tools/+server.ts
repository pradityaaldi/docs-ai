import { streamAIWithTools } from '$lib/server/ai';
import { getActiveAIConnector } from '$lib/server/ai-config';
import { db, projects, documents, folders, messages } from '$lib/server/db';
import { eq, and, isNull } from 'drizzle-orm';
import { buildFolderList, buildSystemPrompt } from '$lib/server/chat-tools/prompt';
import { TOOL_DEFINITIONS, executeToolCall } from '$lib/server/chat-tools/tools';
import type { RequestHandler } from './$types';

function jsonError(error: string, status: number): Response {
	return new Response(JSON.stringify({ error }), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

export const POST: RequestHandler = async ({ request }) => {
	const { project_id, message } = await request.json();

	if (!project_id) return jsonError('Missing project_id', 400);
	if (!message || !message.trim()) return jsonError('Missing message', 400);

	const connector = await getActiveAIConnector();
	if (!connector) return jsonError('No active AI connector', 400);

	const [project] = await db.select().from(projects).where(eq(projects.id, project_id));
	if (!project) return jsonError('Project not found', 404);

	// Find or create the global conversation document (not tied to any project)
	let [convDoc] = await db
		.select()
		.from(documents)
		.where(
			and(
				eq(documents.title, 'Conversation'),
				isNull(documents.projectId),
				isNull(documents.folderId)
			)
		);

	if (!convDoc) {
		[convDoc] = await db
			.insert(documents)
			.values({ title: 'Conversation', content: '' })
			.returning();
	}

	const document_id = convDoc.id;

	// Save user message
	await db.insert(messages).values({ documentId: document_id, role: 'user', content: message });

	// Load folders for tool context
	const folderRows = await db
		.select({ id: folders.id, name: folders.name, parent_id: folders.parentId })
		.from(folders)
		.where(eq(folders.projectId, project_id));

	const systemPrompt = buildSystemPrompt(project.name, buildFolderList(folderRows));

	const t0 = Date.now();
	const signal = request.signal;
	let assistantResponse = '';

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
					console.log(`[TOOLS] start project=${project_id} provider=${connector.provider}`);
					const upstream = await streamAIWithTools(
						connector,
						[{ role: 'user', content: message }],
						systemPrompt,
						TOOL_DEFINITIONS,
						(toolCall) => executeToolCall(toolCall, project_id),
						signal
					);

					const reader = upstream.getReader();
					while (true) {
						if (signal.aborted) {
							reader.cancel().catch(() => {});
							break;
						}
						const { done, value } = await reader.read();
						if (done) break;
						const text = decoder.decode(value, { stream: true });
						assistantResponse += text;
						try { controller.enqueue(value); } catch { break; }
					}
					assistantResponse += decoder.decode();
					console.log(`[TOOLS] done len=${assistantResponse.length} elapsed=${Date.now() - t0}ms`);

					// Save assistant reply (strip tool event markers)
					const cleanReply = assistantResponse
						.replace(/__TOOL__:[^\n]*\n/g, '')
						.trim();
					if (cleanReply && !signal.aborted) {
						await db.insert(messages).values({ documentId: document_id, role: 'assistant', content: cleanReply });
						await db.update(documents).set({ updatedAt: new Date() }).where(eq(documents.id, document_id));
					}
				} catch (e: any) {
					console.error(`[TOOLS] error +${Date.now() - t0}ms`, e?.message || e);
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
			console.log(`[TOOLS] wire cancelled +${Date.now() - t0}ms`);
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
