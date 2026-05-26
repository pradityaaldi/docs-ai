import { generateDocxBuffer } from '$lib/server/docx';
import type { RequestHandler } from './$types';
import getDb from '$lib/server/db';

// POST /api/export/docx - export document as DOCX
export const POST: RequestHandler = async ({ request }) => {
	const { document_id, content } = await request.json();

	const db = getDb();
	const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(document_id) as any;
	if (!document) {
		return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
	}

	const source = typeof content === 'string' && content.trim() ? content : (document.content || '');
	const buffer = await generateDocxBuffer(source);

	return new Response(buffer, {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			'Content-Disposition': `attachment; filename="${document.title || 'document'}.docx"`
		}
	});
};