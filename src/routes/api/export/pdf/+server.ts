import { generatePdfBuffer } from '$lib/server/pdf';
import type { RequestHandler } from './$types';
import { db, documents } from '$lib/server/db';
import { eq } from 'drizzle-orm';

// POST /api/export/pdf - export document as PDF
export const POST: RequestHandler = async ({ request }) => {
	const { document_id } = await request.json();

	const [document] = await db.select().from(documents).where(eq(documents.id, document_id));
	if (!document) {
		return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
	}

	const buffer = await generatePdfBuffer(document.content || '');

	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `attachment; filename="${document.title || 'document'}.pdf"`
		}
	});
};