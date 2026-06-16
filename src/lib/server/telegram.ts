import { env } from '$env/dynamic/private';
import { db, alerts } from '$lib/server/db';
import { eq, and, gte } from 'drizzle-orm';

/** Send a raw message to the admin Telegram chat. Logs to console if unconfigured. */
export async function sendTelegram(message: string): Promise<{ ok: boolean; error?: string }> {
	const token = env.TELEGRAM_BOT_TOKEN;
	const chatId = env.TELEGRAM_CHAT_ID;
	if (!token || !chatId) {
		console.log(`[TELEGRAM — dev, unconfigured] ${message}`);
		return { ok: true };
	}
	try {
		const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
		});
		if (!res.ok) return { ok: false, error: await res.text() };
		return { ok: true };
	} catch (e) {
		return { ok: false, error: (e as Error).message };
	}
}

/**
 * Send an alert with debounce — at most one alert per (type) per day.
 * Logs every sent alert to the alerts table.
 */
export async function sendAlert(type: string, message: string): Promise<void> {
	const since = new Date();
	since.setHours(0, 0, 0, 0);

	const [recent] = await db
		.select({ id: alerts.id })
		.from(alerts)
		.where(and(eq(alerts.type, type), gte(alerts.sentAt, since)))
		.limit(1);

	if (recent) return; // already alerted today for this type

	await sendTelegram(`<b>Paperio</b> [ALERT]: ${message}`);
	await db.insert(alerts).values({ type, message });
}
