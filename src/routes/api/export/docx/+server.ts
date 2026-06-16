import { generateDocxBuffer } from '$lib/server/docx';
import type { RequestHandler } from './$types';
import { db, documents } from '$lib/server/db';
import { eq } from 'drizzle-orm';

// POST /api/export/docx - export document as DOCX
export const POST: RequestHandler = async ({ request }) => {
	const { document_id, content } = await request.json();

	const [document] = await db.select().from(documents).where(eq(documents.id, document_id));
	if (!document) {
		return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
	}

	const source = typeof content === 'string' && content.trim() ? content : (document.content || '');
	const buffer = await generateDocxBuffer(source);

	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			'Content-Disposition': `attachment; filename="${document.title || 'document'}.docx"`
		}
	});
};