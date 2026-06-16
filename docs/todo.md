# TODO — MVP

Order: db → auth → app → payment → admin. Chase demo flow.
Goal: Full MVP (Sprint 0–7), autonomous.

> **STATUS 2026-06-16: Sprint 0–7 SELESAI.** `bun run check` 0 error, `bun run build` (adapter-node) sukses.
> Postgres+Drizzle, full auth (email verify/forgot/Google OAuth), template gallery (6 template seeded),
> single-shot generate (skripsi per-section, surat/makalah single), editor+save, DOCX export (format template),
> Midtrans Snap+webhook+hard paywall+quota, admin dashboard (AI config/monitor/safety+Telegram).
> Sisa minor: regenerate full-doc saja (belum per-section); max_tokens_per_req belum di-thread ke generate.

`[x]` = done · `[ ]` = todo

---

## Sprint 0 — Postgres (do first)

- [ ] add deps: `postgres`, `drizzle-orm`, `drizzle-kit`
- [ ] `DATABASE_URL` env + local Postgres (Docker)
- [ ] `src/lib/server/db/index.ts` — postgres.js + drizzle client
- [ ] `src/lib/server/db/schema.ts` — port tables (no connectors)
- [ ] `drizzle.config.ts` + first migration
- [ ] swap queries (projects/folders/documents/messages)
      from better-sqlite3 → drizzle
- [ ] rename `connectors` → `ai_config` (admin-only, single active)
- [ ] remove user connector UI (SettingsModal, user `/api/connectors/*`)
- [ ] drop `documents.connector_id` (use active ai_config)
- [ ] drop `better-sqlite3`, `data/*.db`

Done = app runs on Postgres, existing features work.

---

## Sprint 1 — Auth (full)

- [ ] users table (email, password_hash nullable, name, role, email_verified, created_at)
- [ ] sessions table or cookie session
- [ ] oauth_accounts + email_verification_tokens + password_reset_tokens tables
- [ ] `src/lib/server/email.ts` — Brevo send helper (API/SMTP)
- [ ] register page + endpoint (hash password) → send verify email
- [ ] email verify endpoint (consume token, set email_verified)
- [ ] login page + endpoint
- [ ] forgot password + reset password (Brevo email + token)
- [ ] Google OAuth flow (code + env placeholder, creds nyusul)
- [ ] logout
- [ ] hooks.server.ts: load user from session
- [ ] protect dashboard routes (redirect if no user / unverified)
- [ ] scope projects/documents to user_id

Done = user register, verify email, login (password + Google), reset password, see own dashboard.

---

## Sprint 2 — Template Gallery

- [x] projects CRUD
- [x] folders CRUD
- [x] documents CRUD
- [ ] templates table (gallery: name, slug, category, kampus/org, struktur,
      format, form_fields, is_active)
- [ ] seed templates: Skripsi UGM/UNY/Amikom, Makalah, Surat Izin Sakit, Surat Izin/Cuti
- [ ] template specs from internet (struktur BAB, font, margin, spasi, daftar pustaka)
- [ ] template gallery UI (browse + filter kategori + pilih) — Google Docs style
- [ ] create-project from template: render form_fields + bahasa, store template_id + input
- [ ] dashboard: project list + status + new button

Done = user browse gallery, pilih template, isi form, project tercipta.

---

## Sprint 3 — AI Single-Shot Generate

- [x] AI integration (OpenAI/Anthropic/Gemini)
- [x] DOCX JSON streaming generate
- [ ] per-template prompt builder (struktur + format + form input + bahasa)
- [ ] single generate endpoint → full DOCX JSON (stream)
- [ ] long docs (skripsi): generate section-by-section server-side, assemble jadi 1 doc
- [ ] save result to db
- [ ] regenerate button (full doc / per-section)
- [ ] count ai_generations per user (for quota)

Done = pilih template → isi form → 1 generate → dokumen full.

---

## Sprint 4 — Editor

- [x] document preview
- [x] code/JSON editor
- [ ] edit per section
- [ ] save (manual or auto)
- [ ] project status field: belum mulai / generated / siap export

Done = user edits AI result.

---

## Sprint 5 — Export DOCX

- [x] DOCX export endpoint
- [x] headings/lists/tables/images
- [ ] cover/kop page from template (kampus/org, judul, nama, dll)
- [ ] apply template format (font, margin, spasi)
- [ ] export full document

Done = download rapi DOCX per template.

---

## Sprint 6 — Payment (Midtrans) + Hard Paywall + Quota

- [ ] plans table (name, quota, max_projects, price)
- [ ] subscriptions table (user_id, plan_id, status, expires_at)
- [ ] payments table (user_id, plan_id, order_id, amount, status, midtrans_token)
- [ ] Midtrans setup: server key, client key, env (sandbox first)
- [ ] custom payment page: pricing → pick plan → checkout form
- [ ] endpoint: create transaction (Midtrans Core/Snap API) → return token
- [ ] custom UI: embed Snap token OR Core API card form (no redirect)
- [ ] webhook endpoint: receive Midtrans notification, verify signature
- [ ] on `settlement`/`capture` → activate subscription + set expires_at
- [ ] hard paywall middleware: block app if no active subscription
- [ ] subscription-expired page → link to payment page
- [ ] enforce quota on generate
- [ ] enforce max projects
- [ ] admin page: manual activate (fallback for demo/testing)

Done = user pays via Midtrans on custom page → access auto-active. No sub = blocked.

---

## Sprint 7 — Admin: AI Config + Monitoring + Safety

See [ai-admin.md](./ai-admin.md).

- [ ] role on users (user/admin), admin-only route guard
- [ ] admin AI config page: set provider/key/model + test + activate
- [ ] generate reads active `ai_config`
- [ ] log every generate to `ai_generations` (tokens, cost, status, latency, template/category)
- [ ] admin monitoring page: usage today/month, per-user, errors
- [ ] `ai_limits` table + admin form
- [ ] guard generate: kill switch, caps, rate limit, max tokens
- [ ] Telegram bot send helper (env creds)
- [ ] alerts on threshold/cap/error-spike/abuse/provider-down + debounce
- [ ] log sent alerts to `alerts`

Done = admin controls AI, sees usage, limits protect cost, Telegram warns.

---

## Demo flow checklist (multi-doc showcase)

- [ ] login (password + Google)
- [ ] dashboard
- [ ] buka template gallery
- [ ] pilih template (skripsi)
- [ ] isi form → generate → edit → export DOCX
- [ ] ulang: makalah
- [ ] ulang: surat izin
- [ ] DOCX rapi tiap jenis
