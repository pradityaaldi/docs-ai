# Tech Stack

Actual stack (not the Next.js plan — already on SvelteKit).

| Part | Tool |
|------|------|
| Framework | SvelteKit (Svelte 5) |
| Styling | Tailwind 4 |
| Database | PostgreSQL |
| Driver | `postgres` (postgres.js) |
| ORM | Drizzle (typed + migrations) |
| Auth | manual cookie session + Google OAuth |
| Email | Brevo (Sendinblue) — verify + forgot password (API or SMTP) |
| Payment | Midtrans (Snap/Core API), custom page, hard paywall |
| AI | admin-set in admin dashboard (db config) — no user connectors |
| AI flow | single-shot generate per template (form → full doc) |
| AI safety | kill switch, budget caps, rate limit, per-user quota |
| Monitoring | admin dashboard: tokens, cost, errors per user |
| Alerts | Telegram bot (warnings/thresholds) |
| Editor | CodeMirror + preview |
| Export | `docx` (DOCX), `pdfkit` (PDF) |
| Storage | local disk on VPS |
| Postgres | local on VPS (no managed/cloud) |
| Hosting | VPS (Node adapter) |

## Key files

- `src/lib/server/db/schema.ts` — Drizzle table defs (new)
- `src/lib/server/db/index.ts` — postgres.js client + drizzle (new)
- `drizzle.config.ts` — migration config (new)
- `src/lib/server/auth.ts` — session, password hash, oauth (new)
- `src/lib/server/email.ts` — Brevo send helper (new)
- `src/lib/server/ai.ts` — streaming + single-shot generate
- `src/lib/server/docx.ts` — DOCX JSON → Word
- `src/lib/stores/app.svelte.ts` — frontend state
- `src/routes/api/` — endpoints
- `src/hooks.server.ts` — empty, add auth here

## Env

```
DATABASE_URL=postgres://user:pass@localhost:5432/paperio
APP_URL=http://localhost:5173      # email links + oauth callback

BREVO_API_KEY=                     # email (verify/reset)
EMAIL_FROM=                        # sender address

GOOGLE_CLIENT_ID=                  # Google OAuth (creds nyusul)
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=

TELEGRAM_BOT_TOKEN=                # alert bot
TELEGRAM_CHAT_ID=                  # admin chat/group
ADMIN_EMAIL=                       # bootstrap first admin
```

AI provider/key NOT in env — admin sets in admin dashboard (db).

## Note

Stack on SvelteKit. DB moved SQLite → Postgres (proper), local on VPS.
Current `src/lib/server/db.ts` (better-sqlite3) replaced by Drizzle +
postgres.js. Migrate before auth.

AI connection admin-only: configured in admin dashboard, stored in
`ai_config` table. User never configures, just uses. Remove user-facing
connector UI (settings modal); rebuild as admin page.

AI generate single-shot: user pilih template → isi form → 1 generate →
full DOCX JSON. Long docs (skripsi) generated section-by-section server-side,
assembled into one document.
