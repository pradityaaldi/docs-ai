# Database

PostgreSQL via Drizzle ORM + postgres.js. Schema in `src/lib/server/db/schema.ts`.
Migrations via `drizzle-kit`.

Conventions: `id` = `serial`/`uuid` PK · `*_id` = FK with `references()` ·
timestamps `timestamptz` default now · JSON cols = `jsonb`.

> Migrating from current SQLite (`better-sqlite3`). Rewrite db layer first,
> then port existing tables below. No prod data → fresh start ok.

## Exists (port to Postgres)

- `projects` — id, name, created_at, updated_at
- `folders` — id, name, project_id, parent_id
- `documents` — id, title, content (jsonb DOCX JSON), project_id, folder_id
- `messages` — id, document_id, role, content

> Drop `connectors` table + `documents.connector_id`. AI config now
> admin-only via admin dashboard → `ai_config` table. No user UI.

## Add for MVP

```
users
  id, email (unique), password_hash (nullable for oauth-only), name,
  role (user/admin), email_verified (bool), created_at

sessions          (or signed cookie)
  id, user_id, expires_at

oauth_accounts                  (Google login)
  id, user_id, provider (google), provider_account_id (unique), created_at

email_verification_tokens
  id, user_id, token (unique), expires_at, created_at

password_reset_tokens
  id, user_id, token (unique), expires_at, used (bool), created_at

ai_config                       (admin-only, set in dashboard)
  id, provider (openai/anthropic/gemini), api_key, model,
  base_url, is_active, updated_by, updated_at

templates                       (gallery — Google Docs style)
  id, name (e.g. "Skripsi UGM"), slug (unique),
  category (skripsi/makalah/surat), kampus (nullable), org (nullable),
  description, struktur (jsonb — sections/BAB),
  format (jsonb — font, font_size, margin, spasi, heading_style,
    daftar_pustaka_style, cover/kop config),
  form_fields (jsonb — fields to ask user before generate),
  is_active, created_at

plans
  id, name, quota, max_projects, price

subscriptions
  id, user_id, plan_id, status, expires_at

payments                        (Midtrans)
  id, user_id, plan_id, order_id (unique), amount,
  status (pending/settlement/expire/cancel), midtrans_token,
  payment_type, created_at, updated_at

ai_generations                  (usage log + monitoring)
  id, user_id, project_id, template_id, category,
  prompt_tokens, completion_tokens, total_tokens, cost,
  status (ok/error), error, latency_ms, created_at

ai_limits                       (safety, single row)
  id, enabled (kill switch), daily_token_cap, monthly_cost_cap,
  per_user_daily_cap, rate_per_min, max_tokens_per_req,
  warn_threshold_pct (e.g. 80), updated_at

alerts                          (telegram log)
  id, type (budget/error_spike/abuse/provider_down),
  message, sent_at
```

### form_fields example (templates.form_fields jsonb)

```
Skripsi UGM:   [judul/ide, nama, NIM, jurusan, dosen_pembimbing, bahasa]
Makalah:       [judul/topik, nama, mata_kuliah, jurusan, bahasa]
Surat Izin Sakit: [nama, kelas/jurusan, tanggal, alasan, ditujukan_ke, bahasa]
```

### Seed templates (MVP)

```
Skripsi UGM · Skripsi UNY · Skripsi Amikom · Makalah/Tugas Kuliah ·
Surat Izin Sakit · Surat Izin/Cuti
```

## Payment flow (Midtrans) — hard paywall

```
user pilih plan (custom payment page)
↓
POST create transaction → Midtrans → snap token
↓
custom page render token (Snap embed / Core API form)
↓
user bayar
↓
Midtrans webhook → verify signature → update payments.status
↓
on settlement → create/extend subscription, set expires_at
↓
no active subscription → app blocked (hard paywall), redirect to payment page
```

Admin manual-activate subscription = fallback buat demo/testing.
Sandbox first. Keys in env: `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`.

## Alter existing

- `projects`: add `user_id`, `template_id`, `input` (jsonb form answers),
  `bahasa`, `status`
- `documents`: add `user_id`

## Status values

`belum mulai` · `generated` · `siap export`
