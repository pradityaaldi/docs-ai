import { generateDocxBuffer } from '$lib/server/docx';
import type { RequestHandler } from './$types';
import getDb from '$lib/server/db';

// POST /api/export/docx - export document as DOCX
export const POST: RequestHandler = async ({ request }) => {
	const { document_id } = await request.json();

	const db = getDb();
	const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(document_id) as any;
	if (!document) {
		return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
	}

	const buffer = await generateDocxBuffer(document.content || '');

	return new Response(buffer, {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			'Content-Disposition': `attachment; filename="${document.title || 'document'}.docx"`
		}
	});
};