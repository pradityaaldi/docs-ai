import { env } from '$env/dynamic/private';
import { createHash } from 'node:crypto';

const isProd = () => env.MIDTRANS_IS_PRODUCTION === 'true';
const snapBase = () =>
	isProd() ? 'https://app.midtrans.com/snap/v1/transactions' : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

export function midtransConfigured(): boolean {
	return !!env.MIDTRANS_SERVER_KEY;
}

export function midtransClientKey(): string {
	return env.MIDTRANS_CLIENT_KEY || '';
}

export function midtransSnapUrl(): string {
	return isProd()
		? 'https://app.midtrans.com/snap/snap.js'
		: 'https://app.sandbox.midtrans.com/snap/snap.js';
}

interface SnapArgs {
	orderId: string;
	amount: number;
	customer: { name?: string; email: string };
	itemName: string;
}

export async function createSnapTransaction(args: SnapArgs): Promise<{ token: string; redirectUrl: string }> {
	const serverKey = env.MIDTRANS_SERVER_KEY!;
	const auth = Buffer.from(`${serverKey}:`).toString('base64');

	const res = await fetch(snapBase(), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			accept: 'application/json',
			Authorization: `Basic ${auth}`
		},
		body: JSON.stringify({
			transaction_details: { order_id: args.orderId, gross_amount: args.amount },
			customer_details: { first_name: args.customer.name || args.customer.email, email: args.customer.email },
			item_details: [{ id: 'plan', price: args.amount, quantity: 1, name: args.itemName }]
		})
	});

	if (!res.ok) {
		throw new Error(`Midtrans error ${res.status}: ${await res.text()}`);
	}
	const data = await res.json();
	return { token: data.token, redirectUrl: data.redirect_url };
}

/** Verify Midtrans notification signature: sha512(order_id + status_code + gross_amount + serverKey). */
export function verifySignature(orderId: string, statusCode: string, grossAmount: string, signatureKey: string): boolean {
	const serverKey = env.MIDTRANS_SERVER_KEY || '';
	const expected = createHash('sha512').update(orderId + statusCode + grossAmount + serverKey).digest('hex');
	return expected === signatureKey;
}
