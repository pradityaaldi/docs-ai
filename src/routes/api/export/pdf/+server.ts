import { generatePdfBuffer } from '$lib/server/pdf';
import type { RequestHandler } from './$types';
import getDb from '$lib/server/db';

// POST /api/export/pdf - export document as PDF
export const POST: RequestHandler = async ({ request }) => {
	const { document_id } = await request.json();

	const db = getDb();
	const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(document_id) as any;
	if (!document) {
		return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
	}

	const buffer = await generatePdfBuffer(document.content || '');

	return new Response(buffer, {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `attachment; filename="${document.title || 'document'}.pdf"`
		}
	});
};