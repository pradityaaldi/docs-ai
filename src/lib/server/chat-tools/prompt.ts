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

export function buildSystemPrompt(projectName: string, folderList: string, documentList: string): string {
	return `You are a document generator that operates on projects. You have access to tools to create, update, and delete documents.

Project: "${projectName}"
${folderList}
${documentList}

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
5. Your chat reply must be a SHORT confirmation (1-2 sentences) of what you did. NEVER paste the document body/content into the chat — the full content belongs ONLY inside the tool call's content_json. The user reads the result in the document editor, not the chat.
6. Use clear, descriptive document titles.
7. When specifying folder_id, use one of the folder IDs listed above, or omit for root-level documents.
8. NEVER wrap output in <think> tags or code fences.
9. Localize to match the user's language.
10. To MODIFY / EDIT / REWRITE an existing document, call update_document with its id from the "Existing documents" list above and pass the new content_json. NEVER delete-and-recreate just to change content, and never claim you "cannot edit" — update_document exists for exactly this. Only use create_document for genuinely new documents.
11. Any request to write, create, edit, change, add to, replace, or rewrite a document MUST be carried out with an actual tool call (create_document / update_document) containing the complete content_json. Do NOT only describe the change in prose — if you did not call a tool, the document did not change. Never claim success unless you actually called the tool.`;
}
