import { streamAIWithTools, type ChatMessage } from '$lib/server/ai';
import { getActiveAIConnector } from '$lib/server/ai-config';
import { db, projects, documents, folders, messages } from '$lib/server/db';
import { eq, and, asc, inArray } from 'drizzle-orm';
import { buildFolderList, buildDocumentList, buildSystemPrompt, buildMentionContext, buildActiveDocContext } from '$lib/server/chat-tools/prompt';
import { TOOL_DEFINITIONS, executeToolCall } from '$lib/server/chat-tools/tools';
import { trimHistoryToBudget, estimateTokens, CONTEXT_WINDOW, REPLY_RESERVE } from '$lib/shared/tokens';
import { stripToolCallJson } from '$lib/shared/tool-call-text';
import type { RequestHandler } from './$types';

function jsonError(error: string, status: number): Response {
	return new Response(JSON.stringify({ error }), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

const MAX_MENTIONS = 8;

export const POST: RequestHandler = async ({ request }) => {
	const { project_id, message, mention_ids, active_document_id } = await request.json();

	if (!project_id) return jsonError('Missing project_id', 400);
	if (!message || !message.trim()) return jsonError('Missing message', 400);

	const connector = await getActiveAIConnector();
	if (!connector) return jsonError('No active AI connector', 400);

	const [project] = await db.select().from(projects).where(eq(projects.id, project_id));
	if (!project) return jsonError('Project not found', 404);

	// Prior conversation for this project (loaded before saving the new message).
	const history = await db
		.select({ role: messages.role, content: messages.content })
		.from(messages)
		.where(eq(messages.projectId, project_id))
		.orderBy(asc(messages.createdAt));

	// Persist the user's message (plain text, per-project).
	await db.insert(messages).values({ projectId: project_id, role: 'user', content: message });

	// Resolve @-mentioned documents (scoped to this project for safety).
	let mentionContext = '';
	const ids: string[] = Array.isArray(mention_ids) ? mention_ids.slice(0, MAX_MENTIONS) : [];
	if (ids.length) {
		const docs = await db
			.select({ title: documents.title, content: documents.content })
			.from(documents)
			.where(and(inArray(documents.id, ids), eq(documents.projectId, project_id)));
		mentionContext = buildMentionContext(docs);
	}

	// Folder + document context so the model can target update/delete by id.
	const folderRows = await db
		.select({ id: folders.id, name: folders.name, parent_id: folders.parentId })
		.from(folders)
		.where(eq(folders.projectId, project_id));
	const docRows = await db
		.select({ id: documents.id, title: documents.title, folder_id: documents.folderId })
		.from(documents)
		.where(eq(documents.projectId, project_id));
	// Indexed outline of the doc the user is viewing, so edits can target by index.
	let activeDocContext = '';
	if (active_document_id) {
		const [activeDoc] = await db
			.select({ title: documents.title, content: documents.content })
			.from(documents)
			.where(and(eq(documents.id, active_document_id), eq(documents.projectId, project_id)));
		if (activeDoc) activeDocContext = buildActiveDocContext(activeDoc.title, activeDoc.content);
	}
	const systemPrompt = buildSystemPrompt(project.name, buildFolderList(folderRows), buildDocumentList(docRows), activeDocContext);

	// Multi-turn context: history + (mentions + this message), trimmed to budget.
	const userContent = mentionContext ? `${mentionContext}\n\n---\n\n${message}` : message;
	// Strip any tool-call JSON that leaked into a past assistant turn — feeding it
	// back trains the model to emit tool calls as text instead of via the API.
	const conversation: ChatMessage[] = [
		...history.map((m) => ({
			role: m.role as ChatMessage['role'],
			content: m.role === 'assistant' ? stripToolCallJson(m.content) : m.content
		})),
		{ role: 'user', content: userContent }
	];
	const budget = CONTEXT_WINDOW - REPLY_RESERVE - estimateTokens(systemPrompt);
	const sendMessages = trimHistoryToBudget(conversation, budget);

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
					console.log(`[TOOLS] start project=${project_id} provider=${connector.provider} msgs=${sendMessages.length} mentions=${ids.length}`);
					const upstream = await streamAIWithTools(
						connector,
						sendMessages,
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

					// Save assistant reply (strip tool event markers + any tool-call JSON).
					const cleanReply = stripToolCallJson(
						assistantResponse.replace(/__TOOL__:[^\n]*\n/g, '').replace(/__DOC__:[^\n]*\n/g, '')
					);
					if (cleanReply && !signal.aborted) {
						await db.insert(messages).values({ projectId: project_id, role: 'assistant', content: cleanReply });
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
