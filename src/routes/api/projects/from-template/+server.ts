import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, templates, projects } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { snakeify } from '$lib/server/serialize';
import { canCreateProject } from '$lib/server/billing';

// Create a project from a template: stores template_id + form input + bahasa.
export const POST: RequestHandler = async ({ request, locals }) => {
	const { slug, input, name } = await request.json();
	if (!slug) return json({ error: 'slug wajib' }, { status: 400 });

	const limit = await canCreateProject(locals.user!.id, locals.user!.role);
	if (!limit.ok) return json({ error: limit.reason }, { status: 402 });

	const [tpl] = await db.select().from(templates).where(eq(templates.slug, slug));
	if (!tpl || !tpl.isActive) return json({ error: 'Template tidak ditemukan' }, { status: 404 });

	const answers = (input && typeof input === 'object') ? input : {};
	const bahasa = answers.bahasa || 'Indonesia';

	// Derive a project name: explicit name → judul → template name
	const derived = (name || answers.judul || answers.nama || tpl.name).toString().trim().slice(0, 120);

	const [project] = await db
		.insert(projects)
		.values({
			name: derived || tpl.name,
			userId: locals.user?.id ?? null,
			templateId: tpl.id,
			input: answers,
			bahasa,
			status: 'belum mulai'
		})
		.returning();

	return json(snakeify(project), { status: 201 });
};
