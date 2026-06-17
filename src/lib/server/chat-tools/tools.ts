import { db, projects, documents } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';
import type { ToolCall, ToolDefinition } from '$lib/server/ai';
import { parseDocxDocument } from '$lib/server/docx';

type BlockOp = {
	action: 'replace' | 'insert_before' | 'insert_after' | 'delete';
	index: number;
	block?: unknown;
};

function isBlock(b: unknown): b is Record<string, unknown> {
	return !!b && typeof b === 'object' && typeof (b as any).type === 'string';
}

/**
 * Apply block operations to a document's content array. All `index` values refer
 * to the ORIGINAL array, so multiple ops compose predictably (a replace at 2 and
 * an insert_after at 2 both target the original block 2). Returns the rebuilt
 * array, the number of blocks touched, or an error string for invalid ops.
 */
function applyBlockOps(content: unknown[], ops: BlockOp[]): { content: unknown[]; changed: number; error?: string } {
	const replace = new Map<number, unknown>();
	const del = new Set<number>();
	const before = new Map<number, unknown[]>();
	const after = new Map<number, unknown[]>();
	const tail: unknown[] = []; // inserts past the end of the array
	let changed = 0;

	for (const op of ops) {
		const i = Number(op.index);
		if (!Number.isInteger(i) || i < 0) return { content, changed: 0, error: `Invalid index: ${op.index}` };
		if (op.action === 'delete') {
			if (i >= content.length) return { content, changed: 0, error: `delete index ${i} out of range` };
			del.add(i); changed++;
		} else if (op.action === 'replace') {
			if (i >= content.length) return { content, changed: 0, error: `replace index ${i} out of range` };
			if (!isBlock(op.block)) return { content, changed: 0, error: `replace at ${i} needs a valid block` };
			replace.set(i, op.block); changed++;
		} else if (op.action === 'insert_before' || op.action === 'insert_after') {
			if (!isBlock(op.block)) return { content, changed: 0, error: `${op.action} at ${i} needs a valid block` };
			if (i >= content.length) { tail.push(op.block); changed++; continue; }
			const map = op.action === 'insert_before' ? before : after;
			(map.get(i) ?? map.set(i, []).get(i)!).push(op.block);
			changed++;
		} else {
			return { content, changed: 0, error: `Unknown action: ${(op as any).action}` };
		}
	}

	const out: unknown[] = [];
	for (let i = 0; i < content.length; i++) {
		if (before.has(i)) out.push(...before.get(i)!);
		if (del.has(i)) { /* dropped */ }
		else if (replace.has(i)) out.push(replace.get(i));
		else out.push(content[i]);
		if (after.has(i)) out.push(...after.get(i)!);
	}
	out.push(...tail);
	return { content: out, changed };
}

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
		description: 'Replace an existing document wholesale (new title and/or full content). For small, local edits prefer update_document_blocks — it is far cheaper and only re-renders the changed part.',
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
		name: 'update_document_blocks',
		description: 'Edit only specific blocks of an existing document, targeting them by their 0-based index in the content array (shown in the document outline). Use this for any local edit (fix a paragraph, add a section, remove a block) instead of rewriting the whole document — it is cheaper and only the changed blocks re-render.',
		parameters: {
			type: 'object',
			properties: {
				document_id: { type: 'string', description: 'ID of the document to edit' },
				operations: {
					type: 'string',
					description: 'JSON array of block operations. Each: {"action":"replace"|"insert_before"|"insert_after"|"delete","index":<0-based block index>,"block":<block>}. The "block" (required for all actions except delete) MUST be a DOCX JSON block in the SAME format as document content blocks — an object with a "type" field, e.g. {"type":"paragraph","text":"New text"} or {"type":"heading","level":2,"text":"Title"}. Do NOT use any other block shape. Indexes refer to the ORIGINAL document; multiple ops apply together. Example: [{"action":"replace","index":3,"block":{"type":"paragraph","text":"Updated paragraph."}}]'
				}
			},
			required: ['document_id', 'operations']
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
			// Tolerant recovery: repairs reasoning/fences/broken JSON, validates blocks.
			const { doc, repaired, warnings } = parseDocxDocument(args.content_json || '');
			if (!doc) {
				return { result: JSON.stringify({ success: false, error: 'Invalid JSON content' }) };
			}
			if (repaired) console.log(`[TOOLS] create_document recovered malformed JSON (${warnings.length} warnings)`);
			const contentJson = JSON.stringify(doc);

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
				const { doc, repaired } = parseDocxDocument(args.content_json);
				if (!doc) {
					return { result: JSON.stringify({ success: false, error: 'Invalid JSON content' }) };
				}
				if (repaired) console.log('[TOOLS] update_document recovered malformed JSON');
				updates.content = JSON.stringify(doc);
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
		case 'update_document_blocks': {
			const docId = args.document_id;
			if (!docId) return { result: JSON.stringify({ success: false, error: 'Missing document_id' }) };

			const [existing] = await db
				.select()
				.from(documents)
				.where(and(eq(documents.id, docId), eq(documents.projectId, projectId)));
			if (!existing) return { result: JSON.stringify({ success: false, error: 'Document not found in this project' }) };

			let parsed: any;
			try { parsed = JSON.parse(existing.content || '{}'); } catch { parsed = null; }
			if (!parsed || !Array.isArray(parsed.content)) {
				return { result: JSON.stringify({ success: false, error: 'Stored document has no block array to edit' }) };
			}

			let ops: BlockOp[];
			try { ops = JSON.parse(args.operations || '[]'); } catch {
				return { result: JSON.stringify({ success: false, error: 'operations is not valid JSON' }) };
			}
			if (!Array.isArray(ops) || ops.length === 0) {
				return { result: JSON.stringify({ success: false, error: 'operations must be a non-empty JSON array' }) };
			}

			const applied = applyBlockOps(parsed.content, ops);
			if (applied.error) return { result: JSON.stringify({ success: false, error: applied.error }) };

			// Re-validate/normalize the assembled document the same way create/update do.
			const { doc } = parseDocxDocument(JSON.stringify({ meta: parsed.meta || {}, content: applied.content }));
			if (!doc) return { result: JSON.stringify({ success: false, error: 'Edit produced invalid document JSON' }) };

			await db
				.update(documents)
				.set({ content: JSON.stringify(doc), updatedAt: new Date() })
				.where(eq(documents.id, docId));
			await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId));

			console.log(`[TOOLS] update_document_blocks applied ${applied.changed} op(s) to ${docId}`);
			return { result: JSON.stringify({ success: true, document_id: docId, title: existing.title, changed_blocks: applied.changed }) };
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
