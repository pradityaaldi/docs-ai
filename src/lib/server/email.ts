import { env } from '$env/dynamic/private';

const BREVO_API = 'https://api.brevo.com/v3/smtp/email';

interface SendArgs {
	to: string;
	subject: string;
	html: string;
}

/**
 * Send a transactional email via Brevo (Sendinblue) API.
 * If BREVO_API_KEY is unset (dev), logs the email to console instead of sending,
 * so the verify/reset flows are still testable locally.
 */
export async function sendEmail({ to, subject, html }: SendArgs): Promise<{ ok: boolean; error?: string }> {
	const apiKey = env.BREVO_API_KEY;
	const from = env.EMAIL_FROM || 'no-reply@paperio.test';

	if (!apiKey) {
		console.log('\n──────── [EMAIL — dev, no BREVO_API_KEY] ────────');
		console.log(`To: ${to}`);
		console.log(`Subject: ${subject}`);
		console.log(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
		console.log('─────────────────────────────────────────────────\n');
		return { ok: true };
	}

	try {
		const res = await fetch(BREVO_API, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				accept: 'application/json',
				'api-key': apiKey
			},
			body: JSON.stringify({
				sender: { email: from, name: 'Paperio' },
				to: [{ email: to }],
				subject,
				htmlContent: html
			})
		});
		if (!res.ok) {
			const err = await res.text();
			console.error('[EMAIL] Brevo error', res.status, err);
			return { ok: false, error: `${res.status}: ${err}` };
		}
		return { ok: true };
	} catch (e) {
		console.error('[EMAIL] send failed', e);
		return { ok: false, error: (e as Error).message };
	}
}

const APP_URL = () => env.APP_URL || 'http://localhost:5173';

export function verifyEmailTemplate(token: string): { subject: string; html: string } {
	const url = `${APP_URL()}/auth/verify?token=${token}`;
	return {
		subject: 'Verifikasi email Paperio kamu',
		html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto">
			<h2>Selamat datang di Paperio</h2>
			<p>Klik tombol di bawah untuk verifikasi email kamu:</p>
			<p><a href="${url}" style="display:inline-block;padding:12px 20px;background:#3b82f6;color:#fff;border-radius:8px;text-decoration:none">Verifikasi Email</a></p>
			<p style="color:#64748b;font-size:13px">Atau buka link ini: <br>${url}</p>
			<p style="color:#94a3b8;font-size:12px">Link berlaku 24 jam.</p>
		</div>`
	};
}

export function resetPasswordTemplate(token: string): { subject: string; html: string } {
	const url = `${APP_URL()}/auth/reset?token=${token}`;
	return {
		subject: 'Reset password Paperio',
		html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto">
			<h2>Reset password</h2>
			<p>Kami terima permintaan reset password. Klik tombol di bawah:</p>
			<p><a href="${url}" style="display:inline-block;padding:12px 20px;background:#3b82f6;color:#fff;border-radius:8px;text-decoration:none">Reset Password</a></p>
			<p style="color:#64748b;font-size:13px">Atau buka link ini: <br>${url}</p>
			<p style="color:#94a3b8;font-size:12px">Link berlaku 1 jam. Abaikan jika kamu tidak meminta ini.</p>
		</div>`
	};
}
