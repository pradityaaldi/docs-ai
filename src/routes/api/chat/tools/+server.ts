import { streamAIWithTools, type ToolCall } from '$lib/server/ai';
import { getActiveAIConnector } from '$lib/server/ai-config';
import { db, projects, documents, folders, messages } from '$lib/server/db';
import { eq, and, isNull, asc } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const DOCX_JSON_SCHEMA = {
	type: 'object',
	properties: {
		meta: {
			type: 'object',
			description: 'Document metadata: pageSize, orientation, margins, font settings',
			properties: {
				pageSize: { type: 'string', enum: ['A4', 'Letter'], description: 'Page size' },
				orientation: { type: 'string', enum: ['portrait', 'landscape'] },
				marginTop: { type: 'number' },
				marginRight: { type: 'number' },
				marginBottom: { type: 'number' },
				marginLeft: { type: 'number' },
				font: { type: 'string' },
				fontSize: { type: 'number' },
				lineSpacing: { type: 'number' }
			}
		},
		content: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					type: { type: 'string', enum: ['heading', 'paragraph', 'bullet', 'numbered', 'table', 'hr', 'code', 'quote', 'pageBreak', 'toc', 'illustration'] },
					level: { type: 'number' },
					text: { type: 'string' },
					items: { type: 'array', items: { type: 'string' } },
					headers: { type: 'array', items: { type: 'string' } },
					rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
					html: { type: 'string' },
					width: { type: 'number' },
					height: { type: 'number' },
					caption: { type: 'string' },
					label: { type: 'string' },
					alignment: { type: 'string' },
					runs: {
						type: 'array',
						items: {
							type: 'object',
							properties: {
								text: { type: 'string' },
								bold: { type: 'boolean' },
								italic: { type: 'boolean' },
								color: { type: 'string' },
								font: { type: 'string' },
								size: { type: 'number' }
							}
						}
					}
				},
				required: ['type']
			}
		}
	},
	required: ['meta', 'content']
};

export const POST: RequestHandler = async ({ request }) => {
	const { project_id, message } = await request.json();

	if (!project_id) {
		return new Response(JSON.stringify({ error: 'Missing project_id' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	if (!message || !message.trim()) {
		return new Response(JSON.stringify({ error: 'Missing message' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const connector = await getActiveAIConnector();
	if (!connector) {
		return new Response(JSON.stringify({ error: 'No active AI connector' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const [project] = await db.select().from(projects).where(eq(projects.id, project_id));
	if (!project) {
		return new Response(JSON.stringify({ error: 'Project not found' }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' }
		});
	}

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

	const folderList = folderRows.length > 0
		? `Available folders:\n${folderRows.map(f => `  - "${f.name}" (id: ${f.id}${f.parent_id ? `, parent: ${f.parent_id}` : ', root-level'})`).join('\n')}`
		: 'No folders exist yet. You can specify a folder_name to create a new folder, or omit folder_id for root-level.';

	const systemPrompt = `You are a document generator that operates on projects. You have access to tools to create, update, and delete documents.

Project: "${project.name}"
${folderList}

TOOLS AVAILABLE:
- create_document: Create a new document in this project
- update_document: Update an existing document's title or content
- delete_document: Delete a document from the project

DOCUMENT FORMAT:
Documents use DOCX JSON format — a structured JSON that maps directly to Word elements. The JSON structure:

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
    { "type": "paragraph", "runs": [
      { "text": "Bold", "bold": true },
      { "text": " normal text " }
    ]},
    { "type": "bullet", "items": ["Item one", "Item two"] },
    { "type": "numbered", "items": ["Step one", "Step two"] },
    { "type": "table", "headers": ["Col A", "Col B"], "rows": [["A1", "B1"], ["A2", "B2"]] },
    { "type": "hr" },
    { "type": "code", "text": "console.log('hello');" },
    { "type": "quote", "text": "Important callout" },
    { "type": "pageBreak" },
    { "type": "toc", "label": "Table of Contents" },
    { "type": "illustration", "html": "<div style=\"...\">...</div>", "width": 640, "height": 400 }
  ]
}

Content block types:
- heading (level 1-5): Section headings
- paragraph: Text with inline markdown (**, *, etc) or precise runs array
- bullet / numbered: Lists
- table: With headers and rows arrays
- hr: Horizontal rule
- code: Code blocks
- quote: Blockquotes
- pageBreak: Force page break
- toc: Table of contents — auto-populated from headings. Add "label" for the title.
- illustration: HTML+CSS diagram/chart rendered as PNG image

IMPORTANT RULES:
1. When the user asks to create multiple documents (e.g., "5 documents about vegetables"), use create_document tool for EACH one.
2. Each document should have a complete DOCX JSON with meta and content.
3. Always include a proper meta object and start content with a heading level 1 as the document title.
4. Make content thorough and detailed — real content, not placeholders.
5. After creating all documents, provide a brief summary of what was created.
6. Use clear, descriptive document titles.
7. When specifying folder_id, use one of the folder IDs listed above, or omit for root-level documents.
8. NEVER wrap output in <think> tags or code fences.
9. Localize to match the user's language.`;

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
						[
							{
								name: 'create_document',
								description: 'Create a new document in the current project. Use this to create one document at a time. For multiple documents, call this tool multiple times.',
								parameters: {
									type: 'object',
									properties: {
										title: { type: 'string', description: 'Document title' },
										content_json: { type: 'string', description: 'The complete document content as a DOCX JSON string (must include meta and content arrays)' },
										folder_id: { type: 'string', description: 'Optional folder ID. Use from the available folders list, or omit for root-level.' }
									},
									required: ['title', 'content_json']
								}
							},
							{
								name: 'update_document',
								description: 'Update an existing document in the project',
								parameters: {
									type: 'object',
									properties: {
										document_id: { type: 'string', description: 'ID of the document to update' },
										title: { type: 'string', description: 'New title for the document' },
										content_json: { type: 'string', description: 'New DOCX JSON content for the document' }
									},
									required: ['document_id']
								}
							},
							{
								name: 'delete_document',
								description: 'Delete a document from the project',
								parameters: {
									type: 'object',
									properties: {
										document_id: { type: 'string', description: 'ID of the document to delete' }
									},
									required: ['document_id']
								}
							}
						],
						async (toolCall: ToolCall) => {
							console.log(`[TOOLS] executing ${toolCall.name}`, toolCall.arguments);
							const args = toolCall.arguments as Record<string, string>;

							switch (toolCall.name) {
								case 'create_document': {
									const title = (args.title || 'Untitled Document').trim();
									let contentJson = (args.content_json || '').trim();

									// Strip thinking blocks and code fences
									contentJson = contentJson.replace(/<think>[\s\S]*?<\/think>/g, '');
									contentJson = contentJson.replace(/```(?:json)?\s*/gi, '');
									contentJson = contentJson.replace(/```\s*$/g, '');
									const braceIdx = contentJson.indexOf('{');
									if (braceIdx > 0) contentJson = contentJson.slice(braceIdx);

									// Validate JSON
									let parsed: any;
									try {
										parsed = JSON.parse(contentJson);
									} catch {
										return { result: JSON.stringify({ success: false, error: 'Invalid JSON content' }) };
									}

									if (!parsed.meta || !parsed.content) {
										return { result: JSON.stringify({ success: false, error: 'Content must have meta and content fields' }) };
									}

									const folderId = args.folder_id || null;

									const [created] = await db
										.insert(documents)
										.values({ title, content: contentJson, projectId: project_id, folderId })
										.returning({ id: documents.id });
									await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, project_id));

									return { result: JSON.stringify({ success: true, document_id: created.id, title }) };
								}
								case 'update_document': {
									const docId = args.document_id;
									if (!docId) return { result: JSON.stringify({ success: false, error: 'Missing document_id' }) };

									const [existing] = await db
										.select()
										.from(documents)
										.where(and(eq(documents.id, docId), eq(documents.projectId, project_id)));
									if (!existing) return { result: JSON.stringify({ success: false, error: 'Document not found in this project' }) };

									const updates: { title?: string; content?: string } = {};
									if (args.title) updates.title = args.title;
									if (args.content_json) {
										let cj = args.content_json;
										cj = cj.replace(/<think>[\s\S]*?<\/think>/g, '');
										cj = cj.replace(/```(?:json)?\s*/gi, '');
										cj = cj.replace(/```\s*$/g, '');
										const braceIdx = cj.indexOf('{');
										if (braceIdx > 0) cj = cj.slice(braceIdx);
										try { JSON.parse(cj); } catch {
											return { result: JSON.stringify({ success: false, error: 'Invalid JSON content' }) };
										}
										updates.content = cj;
									}

									if (Object.keys(updates).length === 0) {
										return { result: JSON.stringify({ success: false, error: 'No updates specified' }) };
									}

									await db
										.update(documents)
										.set({ ...updates, updatedAt: new Date() })
										.where(eq(documents.id, docId));
									await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, project_id));

									return { result: JSON.stringify({ success: true, document_id: docId, title: args.title || existing.title }) };
								}
								case 'delete_document': {
									const docId = args.document_id;
									if (!docId) return { result: JSON.stringify({ success: false, error: 'Missing document_id' }) };

									const [existing] = await db
										.select()
										.from(documents)
										.where(and(eq(documents.id, docId), eq(documents.projectId, project_id)));
									if (!existing) return { result: JSON.stringify({ success: false, error: 'Document not found in this project' }) };

									await db.delete(documents).where(eq(documents.id, docId));
									await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, project_id));

									return { result: JSON.stringify({ success: true, document_id: docId, title: existing.title }) };
								}
								default:
									return { result: JSON.stringify({ success: false, error: `Unknown tool: ${toolCall.name}` }) };
							}
						},
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
