import { db, projects, documents } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';
import type { ToolCall, ToolDefinition } from '$lib/server/ai';
import { cleanContentJson } from './clean-json';

export const TOOL_DEFINITIONS: ToolDefinition[] = [
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
];

/**
 * Execute one tool call against the given project. Returns the `{ result }` shape
 * expected by `streamAIWithTools` — a JSON string the model reads back.
 */
export async function executeToolCall(toolCall: ToolCall, projectId: string): Promise<{ result: string }> {
	console.log(`[TOOLS] executing ${toolCall.name}`, toolCall.arguments);
	const args = toolCall.arguments as Record<string, string>;

	switch (toolCall.name) {
		case 'create_document': {
			const title = (args.title || 'Untitled Document').trim();
			const contentJson = cleanContentJson(args.content_json || '');

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
				.values({ title, content: contentJson, projectId, folderId })
				.returning({ id: documents.id });
			await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId));

			return { result: JSON.stringify({ success: true, document_id: created.id, title }) };
		}
		case 'update_document': {
			const docId = args.document_id;
			if (!docId) return { result: JSON.stringify({ success: false, error: 'Missing document_id' }) };

			const [existing] = await db
				.select()
				.from(documents)
				.where(and(eq(documents.id, docId), eq(documents.projectId, projectId)));
			if (!existing) return { result: JSON.stringify({ success: false, error: 'Document not found in this project' }) };

			const updates: { title?: string; content?: string } = {};
			if (args.title) updates.title = args.title;
			if (args.content_json) {
				const cj = cleanContentJson(args.content_json);
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
			await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId));

			return { result: JSON.stringify({ success: true, document_id: docId, title: args.title || existing.title }) };
		}
		case 'delete_document': {
			const docId = args.document_id;
			if (!docId) return { result: JSON.stringify({ success: false, error: 'Missing document_id' }) };

			const [existing] = await db
				.select()
				.from(documents)
				.where(and(eq(documents.id, docId), eq(documents.projectId, projectId)));
			if (!existing) return { result: JSON.stringify({ success: false, error: 'Document not found in this project' }) };

			await db.delete(documents).where(eq(documents.id, docId));
			await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId));

			return { result: JSON.stringify({ success: true, document_id: docId, title: existing.title }) };
		}
		default:
			return { result: JSON.stringify({ success: false, error: `Unknown tool: ${toolCall.name}` }) };
	}
}
