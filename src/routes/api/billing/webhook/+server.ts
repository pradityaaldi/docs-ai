import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, payments } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { verifySignature } from '$lib/server/midtrans';
import { activateSubscription } from '$lib/server/billing';

// Midtrans posts here (no session) — must be in PUBLIC_API in hooks.server.ts.
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const orderId = body.order_id as string;
	const statusCode = String(body.status_code ?? '');
	const grossAmount = String(body.gross_amount ?? '');
	const signatureKey = body.signature_key as string;
	const txStatus = body.transaction_status as string;
	const fraudStatus = body.fraud_status as string | undefined;
	const paymentType = body.payment_type as string | undefined;

	if (!orderId || !verifySignature(orderId, statusCode, grossAmount, signatureKey)) {
		return json({ error: 'Invalid signature' }, { status: 403 });
	}

	const [payment] = await db.select().from(payments).where(eq(payments.orderId, orderId));
	if (!payment) return json({ error: 'Order not found' }, { status: 404 });

	// map midtrans status → our enum
	const allowed = ['pending', 'settlement', 'capture', 'expire', 'cancel', 'deny', 'failure'] as const;
	const status = (allowed as readonly string[]).includes(txStatus) ? (txStatus as (typeof allowed)[number]) : 'pending';

	await db
		.update(payments)
		.set({ status, paymentType: paymentType ?? payment.paymentType, updatedAt: new Date() })
		.where(eq(payments.id, payment.id));

	const paid = (txStatus === 'settlement' || (txStatus === 'capture' && fraudStatus === 'accept'));
	if (paid && payment.planId) {
		await activateSubscription(payment.userId, payment.planId);
	}

	return json({ ok: true });
};
