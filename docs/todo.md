# TODO — MVP

Order: db → auth → app → payment. Chase demo flow.

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

## Sprint 1 — Auth

- [ ] users table (id, email, password_hash, name, created_at)
- [ ] sessions table or cookie session
- [ ] register page + endpoint (hash password)
- [ ] login page + endpoint
- [ ] logout
- [ ] hooks.server.ts: load user from session
- [ ] protect dashboard routes (redirect if no user)
- [ ] scope projects/documents to user_id

Done = user register, login, see own dashboard.

---

## Sprint 2 — Project + Template

- [x] projects CRUD
- [x] folders CRUD
- [x] documents CRUD
- [ ] templates table (kampus, struktur BAB, font, margin, spasi, heading)
- [ ] seed 3 templates: Amikom, UGM, UNY
- [ ] create-project form: kampus, jenis dokumen, jurusan, ide, bahasa
- [ ] store template_id on project
- [ ] dashboard: project list + status + new button

Done = user creates project with kampus template.

---

## Sprint 3 — AI Thesis Flow

- [x] AI integration (OpenAI/Anthropic/Gemini)
- [x] DOCX JSON streaming generate
- [ ] prompt: 5 alternatif judul from ide
- [ ] UI: show judul list → user picks one
- [ ] prompt: outline BAB I–V from judul + template
- [ ] prompt: draft BAB I from outline
- [ ] save each step to db
- [ ] regenerate button per step
- [ ] count ai_generations per user (for quota)

Done = ide → judul → outline → BAB I.

---

## Sprint 4 — Editor

- [x] document preview
- [x] code/JSON editor
- [ ] edit per section (Latar Belakang, Rumusan, etc)
- [ ] save (manual or auto)
- [ ] project status field: belum mulai / outline / BAB I / siap export

Done = user edits AI result.

---

## Sprint 5 — Export DOCX

- [x] DOCX export endpoint
- [x] headings/lists/tables/images
- [ ] cover page from template (kampus, judul, nama, jurusan)
- [ ] apply template format (font, margin, spasi)
- [ ] export outline + BAB I

Done = download rapi DOCX.

---

## Sprint 6 — Payment (Midtrans) + Quota

- [ ] plans table (name, quota, max_projects, price)
- [ ] subscriptions table (user_id, plan_id, status, expires_at)
- [ ] payments table (user_id, plan_id, order_id, amount, status, midtrans_token)
- [ ] Midtrans setup: server key, client key, env (sandbox first)
- [ ] custom payment page: pricing → pick plan → checkout form
- [ ] endpoint: create transaction (Midtrans Core/Snap API) → return token
- [ ] custom UI: embed Snap token OR Core API card form (no redirect)
- [ ] webhook endpoint: receive Midtrans notification, verify signature
- [ ] on `settlement`/`capture` → activate subscription + set expires_at
- [ ] middleware: block app if no active subscription
- [ ] subscription-expired page → link to payment page
- [ ] enforce quota on generate
- [ ] enforce max projects
- [ ] admin page: manual activate (fallback)

Done = user pays via Midtrans on custom page → access auto-active.

---

## Sprint 7 — Admin: AI Config + Monitoring + Safety

See [ai-admin.md](./ai-admin.md).

- [ ] role on users (user/admin), admin-only route guard
- [ ] admin AI config page: set provider/key/model + test + activate
- [ ] generate reads active `ai_config`
- [ ] log every generate to `ai_generations` (tokens, cost, status, latency)
- [ ] admin monitoring page: usage today/month, per-user, errors
- [ ] `ai_limits` table + admin form
- [ ] guard generate: kill switch, caps, rate limit, max tokens
- [ ] Telegram bot send helper (env creds)
- [ ] alerts on threshold/cap/error-spike/abuse/provider-down + debounce
- [ ] log sent alerts to `alerts`

Done = admin controls AI, sees usage, limits protect cost, Telegram warns.

---

## Demo flow checklist

- [ ] login
- [ ] dashboard
- [ ] buat project
- [ ] pilih kampus + template
- [ ] input ide
- [ ] AI judul → pilih
- [ ] AI outline BAB I–V
- [ ] AI BAB I
- [ ] edit
- [ ] export DOCX
- [ ] DOCX rapi
