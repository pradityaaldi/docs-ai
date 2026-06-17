interface FolderRow {
	id: string;
	name: string;
	parent_id: string | null;
}

interface DocRow {
	id: string;
	title: string;
	folder_id: string | null;
}

export function buildFolderList(folderRows: FolderRow[]): string {
	return folderRows.length > 0
		? `Available folders:\n${folderRows.map(f => `  - "${f.name}" (id: ${f.id}${f.parent_id ? `, parent: ${f.parent_id}` : ', root-level'})`).join('\n')}`
		: 'No folders exist yet. You can specify a folder_name to create a new folder, or omit folder_id for root-level.';
}

export function buildDocumentList(docRows: DocRow[]): string {
	return docRows.length > 0
		? `Existing documents in this project (use the id with update_document / delete_document):\n${docRows.map(d => `  - "${d.title}" (id: ${d.id}${d.folder_id ? `, folder: ${d.folder_id}` : ', root-level'})`).join('\n')}`
		: 'No documents exist yet in this project.';
}

// Per-file cap so @-mentioned documents can't blow the context window.
const MENTION_CHAR_CAP = 4000;

export function buildMentionContext(docs: { title: string; content: string }[]): string {
	if (!docs.length) return '';
	const blocks = docs.map((d) => {
		const c =
			d.content.length > MENTION_CHAR_CAP
				? d.content.slice(0, MENTION_CHAR_CAP) + '\n…(dipotong)'
				: d.content;
		return `--- File: ${d.title} ---\n${c || '(kosong)'}`;
	});
	return `File yang dirujuk user (untuk konteks/edit):\n\n${blocks.join('\n\n')}`;
}

// One-line label for a block, for the indexed outline shown to the model.
function blockLabel(b: any): string {
	const clip = (s: string) => (s.length > 80 ? s.slice(0, 80) + '…' : s).replace(/\s+/g, ' ').trim();
	switch (b?.type) {
		case 'heading': return `heading${b.level ? ` h${b.level}` : ''}: ${clip(b.text || '')}`;
		case 'paragraph': return `paragraph: ${clip(b.text || (Array.isArray(b.runs) ? b.runs.map((r: any) => r.text).join('') : ''))}`;
		case 'bullet': return `bullet: ${clip((b.items || []).join(' • '))}`;
		case 'numbered': return `numbered: ${clip((b.items || []).join(' • '))}`;
		case 'table': return `table: [${(b.headers || []).join(', ')}]`;
		case 'quote': return `quote: ${clip(b.text || '')}`;
		case 'code': return `code: ${clip(b.text || '')}`;
		default: return String(b?.type || 'unknown');
	}
}

/**
 * Indexed outline of a document's blocks so the model can target edits by index
 * with update_document_blocks. Returns '' when the content has no block array.
 */
export function buildBlockOutline(content: string): string {
	let doc: any;
	try { doc = JSON.parse(content || '{}'); } catch { return ''; }
	if (!doc || !Array.isArray(doc.content)) return '';
	return doc.content.map((b: any, i: number) => `  [${i}] ${blockLabel(b)}`).join('\n');
}

// Context block for the document the user currently has open — its indexed
// outline, so a follow-up like "fix the second paragraph" can target by index.
export function buildActiveDocContext(title: string, content: string): string {
	const outline = buildBlockOutline(content);
	if (!outline) return '';
	return `The user is currently viewing this document (edit it with update_document_blocks, targeting blocks by their [index]):\n--- "${title}" ---\n${outline}`;
}

export function buildSystemPrompt(projectName: string, folderList: string, documentList: string, activeDocContext = ''): string {
	return `You are a document generator that operates on projects. You have access to tools to create, update, and delete documents.

Project: "${projectName}"
${folderList}
${documentList}
${activeDocContext ? `\n${activeDocContext}\n` : ''}
TOOLS AVAILABLE:
- create_document: Create a new document in this project
- update_document: Replace an existing document's full content (use only for large rewrites)
- update_document_blocks: Edit specific blocks of a document by their [index] — the preferred way to make local edits
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
5. Your chat reply must be a SHORT confirmation (1-2 sentences) of what you did. NEVER paste the document body/content into the chat — the full content belongs ONLY inside the tool call's content_json. The user reads the result in the document editor, not the chat.
6. Use clear, descriptive document titles.
7. When specifying folder_id, use one of the folder IDs listed above, or omit for root-level documents.
8. NEVER wrap output in <think> tags or code fences.
9. Localize to match the user's language.
10. To MODIFY / EDIT an existing document, prefer update_document_blocks: target the specific block(s) by their [index] from the outline and pass only the new block(s). This is cheaper and only re-renders what changed. Use update_document (full content_json) only for a large rewrite of most of the document. NEVER delete-and-recreate to change content, and never claim you "cannot edit". Only use create_document for genuinely new documents.
11. For update_document_blocks, build the operations array carefully: indices refer to the document's CURRENT blocks (the outline). To change a block use "replace"; to add use "insert_before"/"insert_after"; to remove use "delete". Each non-delete op needs a complete DOCX "block" object.
12. Any request to write, create, edit, change, add to, replace, or rewrite a document MUST be carried out with an actual tool call. Do NOT only describe the change in prose — if you did not call a tool, the document did not change. Never claim success unless you actually called the tool.`;
}
