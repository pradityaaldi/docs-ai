import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, plans, payments } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { createSnapTransaction, midtransConfigured, midtransClientKey, midtransSnapUrl } from '$lib/server/midtrans';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user!;
	const { planId } = await request.json();
	if (!planId) return json({ error: 'planId wajib' }, { status: 400 });

	const [plan] = await db.select().from(plans).where(eq(plans.id, planId));
	if (!plan || !plan.isActive) return json({ error: 'Paket tidak ditemukan' }, { status: 404 });

	const orderId = `PAPERIO-${plan.id.slice(0, 8)}-${Date.now()}`;

	// record pending payment
	const [payment] = await db
		.insert(payments)
		.values({ userId: user.id, planId: plan.id, orderId, amount: plan.price, status: 'pending' })
		.returning();

	if (!midtransConfigured()) {
		// keys belum diisi — hard paywall demo via admin manual-activate
		return json({
			configured: false,
			order_id: orderId,
			payment_id: payment.id,
			message: 'Midtrans belum dikonfigurasi. Minta admin aktifkan langganan (mode demo).'
		});
	}

	try {
		const { token, redirectUrl } = await createSnapTransaction({
			orderId,
			amount: plan.price,
			customer: { name: user.name, email: user.email },
			itemName: plan.name
		});
		await db.update(payments).set({ midtransToken: token, updatedAt: new Date() }).where(eq(payments.id, payment.id));
		return json({
			configured: true,
			token,
			redirect_url: redirectUrl,
			client_key: midtransClientKey(),
			snap_url: midtransSnapUrl(),
			order_id: orderId
		});
	} catch (e) {
		return json({ error: (e as Error).message }, { status: 502 });
	}
};
