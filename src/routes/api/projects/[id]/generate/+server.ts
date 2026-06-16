import type { RequestHandler } from './$types';
import { db, projects, templates, documents, aiGenerations } from '$lib/server/db';
import { eq, and, isNull, gte, sql } from 'drizzle-orm';
import { getActiveAIConnector } from '$lib/server/ai-config';
import { generateProjectDocument } from '$lib/server/generate';
import { checkAndConsumeQuota } from '$lib/server/quota';
import { getActiveSubscription } from '$lib/server/billing';
import { sendAlert } from '$lib/server/telegram';

function jsonError(msg: string, status = 400) {
	return new Response(JSON.stringify({ error: msg }), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

export const POST: RequestHandler = async ({ params, locals, request }) => {
	const userId = locals.user!.id; // hooks guards /api

	const [project] = await db.select().from(projects).where(eq(projects.id, params.id));
	if (!project) return jsonError('Project tidak ditemukan', 404);
	if (project.userId && project.userId !== userId) return jsonError('Forbidden', 403);
	if (!project.templateId) return jsonError('Project ini tidak punya template', 400);

	const [tpl] = await db.select().from(templates).where(eq(templates.id, project.templateId));
	if (!tpl) return jsonError('Template tidak ditemukan', 404);

	const connector = await getActiveAIConnector();
	if (!connector) return jsonError('AI belum dikonfigurasi admin', 400);

	// hard paywall — admins bypass
	if (locals.user!.role !== 'admin') {
		const sub = await getActiveSubscription(userId);
		if (!sub) return jsonError('Langganan tidak aktif. Silakan berlangganan dulu.', 402);
	}

	// quota + safety gate (kill switch, per-user cap, plan quota consume)
	const gate = await checkAndConsumeQuota(userId);
	if (!gate.ok) return jsonError(gate.reason || 'Kuota habis', 402);

	const signal = request.signal;
	const t0 = Date.now();
	const encoder = new TextEncoder();

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const send = (obj: Record<string, unknown>) => {
				try { controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n')); } catch {}
			};
			// heartbeat
			let closed = false;
			const hb = setInterval(() => { if (!closed) try { controller.enqueue(encoder.encode(' ')); } catch {} }, 5000);

			try {
				send({ type: 'start', category: tpl.category });
				const { docJson, usage } = await generateProjectDocument(tpl, project, connector, signal, send);

				if (signal.aborted) {
					send({ type: 'aborted' });
					return;
				}

				// upsert the project's main document (root, title = project name)
				const [existing] = await db
					.select()
					.from(documents)
					.where(and(eq(documents.projectId, project.id), isNull(documents.folderId), eq(documents.title, project.name)));

				let docId: string;
				if (existing) {
					await db.update(documents).set({ content: docJson, updatedAt: new Date() }).where(eq(documents.id, existing.id));
					docId = existing.id;
				} else {
					const [created] = await db
						.insert(documents)
						.values({ title: project.name, content: docJson, userId, projectId: project.id })
						.returning({ id: documents.id });
					docId = created.id;
				}

				await db.update(projects).set({ status: 'generated', updatedAt: new Date() }).where(eq(projects.id, project.id));

				await db.insert(aiGenerations).values({
					userId,
					projectId: project.id,
					templateId: tpl.id,
					category: tpl.category,
					promptTokens: usage.promptTokens,
					completionTokens: usage.completionTokens,
					totalTokens: usage.totalTokens,
					cost: estimateCost(connector.provider, usage.totalTokens),
					status: 'ok',
					latencyMs: Date.now() - t0
				});

				send({ type: 'done', document_id: docId, total_tokens: usage.totalTokens });
			} catch (e: any) {
				const msg = e?.message || String(e);
				console.error('[GENERATE] error', msg);
				await db.insert(aiGenerations).values({
					userId,
					projectId: project.id,
					templateId: tpl.id,
					category: tpl.category,
					status: 'error',
					error: msg.slice(0, 500),
					latencyMs: Date.now() - t0
				}).catch(() => {});

				// provider-down vs error-spike alerting
				if (/401|403|invalid api key|unauthorized|econnrefused|enotfound|fetch failed/i.test(msg)) {
					await sendAlert('provider_down', `AI provider error: ${msg.slice(0, 120)}`).catch(() => {});
				} else {
					const tenMinAgo = new Date(Date.now() - 10 * 60_000);
					const [{ c }] = await db
						.select({ c: sql<number>`count(*)` })
						.from(aiGenerations)
						.where(and(eq(aiGenerations.status, 'error'), gte(aiGenerations.createdAt, tenMinAgo)));
					if (Number(c) >= 3) await sendAlert('error_spike', `Lonjakan error generate: ${c} dalam 10 menit.`).catch(() => {});
				}

				send({ type: 'error', error: msg });
			} finally {
				closed = true;
				clearInterval(hb);
				try { controller.close(); } catch {}
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'application/x-ndjson; charset=utf-8',
			'Cache-Control': 'no-cache',
			'X-Accel-Buffering': 'no'
		}
	});
};

// Rough cost estimate (USD) per 1k tokens — admin can refine later.
function estimateCost(provider: string, totalTokens: number): number {
	const per1k: Record<string, number> = { openai: 0.0025, anthropic: 0.003, gemini: 0.0005 };
	return ((per1k[provider] ?? 0.002) * totalTokens) / 1000;
}
