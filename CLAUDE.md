# CLAUDE.md

Guidance for working in this repo. Read before making changes.

## Project

**Paperio** — AI document generator (Indonesian market). User picks a named template
(Skripsi UGM, Makalah, Surat Izin Sakit, …), fills a form, AI generates the full
document single-shot. Hard paywall via Midtrans subscription. AI provider/key is set
by admin in the admin dashboard (not by users, not in env).

See `docs/` for product specs: `mvp.md`, `stack.md`, `database.md`, `ai-admin.md`, `roadmap.md`.

## Stack

| Part | Tool |
|------|------|
| Framework | SvelteKit + Svelte 5 (runes) |
| Styling | Tailwind 4 (`@import "tailwindcss"` in `src/app.css`) + CSS vars |
| Runtime / pkg mgr | Bun |
| DB | PostgreSQL via Drizzle ORM + `postgres` (postgres.js) |
| Auth | manual cookie session + Google OAuth |
| Email | Brevo (verify + password reset) |
| Payment | Midtrans Snap (hard paywall) |
| AI | admin-configured in DB (`ai_config`), single-shot generate |
| Export | `docx` (DOCX), `pdfkit` (PDF) |
| Editor | CodeMirror + live preview |
| Hosting | VPS, Node adapter |

Postgres: local DB `paperio`, role `postgres`.

## Commands

```bash
bun run dev          # vite dev server
bun run build        # production build
bun run check        # svelte-kit sync + svelte-check (run before committing)
bun run db:generate  # generate Drizzle migration from schema
bun run db:migrate   # apply migrations
bun run db:push      # push schema (dev)
bun run db:seed      # seed templates/plans (scripts/seed.ts)
```

## Directory layout

```
src/
  app.css                      # Tailwind import + design tokens (CSS vars) + markdown styles
  hooks.server.ts              # auth: resolve session → locals.user
  lib/
    actions.ts                 # frontend action helpers (load projects, enter project, …)
    stores/app.svelte.ts       # global runed app state ($state class instance `app`)
    shared/                    # isomorphic helpers (toc, illustration)
    server/                    # server-only — never import into client
      db/{index,schema}.ts     # postgres.js client + Drizzle tables
      auth.ts ai.ts billing.ts quota.ts midtrans.ts email.ts telegram.ts
      docx.ts pdf.ts generate.ts serialize.ts ai-config.ts admin-guard.ts
    components/
      ui/                      # reusable design-system primitives (see below)
      auth/                    # auth-screen pieces (AuthShell, Divider, GoogleButton)
      Sidebar / ChatPanel / DocumentPreview   # feature components
  routes/                      # SvelteKit file routes + /api/* endpoints
```

## Component system

UI is component-based. **Reuse primitives — do not re-hand-roll Tailwind for buttons,
inputs, cards, etc.** Import from the barrel:

```svelte
import { Button, Input, Card, Alert, PageHeader, Tabs } from '$lib/components/ui';
```

### `src/lib/components/ui/` primitives

| Component | Purpose / key props |
|-----------|--------------------|
| `Button` | `variant` primary\|neutral\|danger\|ghost · `size` sm\|md · `full` · `loading` · `href` (renders `<a>`) |
| `Input` | `bind:value`, any input attr (type/placeholder/required/step…) |
| `Textarea` | `bind:value`, `rows` |
| `Select` | `bind:value`, `<option>` children |
| `Field` | label wrapper — `label`, `forId`, `required` |
| `Card` | `rounded` lg\|xl · `padding` none\|sm\|md\|lg |
| `Alert` | `variant` error\|info\|success |
| `PageHeader` | `title`, `subtitle`, `{#snippet actions()}` for right side |
| `Tabs` | `tabs={[{key,label}]}` + `bind:active` |
| `StatCard` | `label`, `value` |
| `Badge` `Breadcrumb` `CodeEditor` `TreeItem` | existing feature primitives |

`src/lib/components/auth/`: `AuthShell` (centered card layout), `Divider`, `GoogleButton`.

### Conventions

- **Svelte 5 runes**: `let { ... }: Props = $props()`, `$state`, `$derived`, `$effect`,
  `$bindable()` for two-way props. Snippets (`Snippet` / `{#snippet}` / `{@render}`) not slots.
- Props typed via `interface Props` (extend `HTML*Attributes` for native passthrough + `...rest`).
- Styling = **CSS vars from `app.css`** (e.g. `var(--fg-interactive)`, `var(--bg-component)`,
  `var(--border-base)`, `var(--tag-red-bg)`). No hardcoded hex in components. Dark theme.
- Class override: every primitive accepts `class` and merges it last.
- Pages that own a full screen import `../app.css` and wrap in `min-h-dvh bg-[var(--bg-base)]`.

When a markup pattern repeats across pages, extract a primitive into `ui/` and add it to
`ui/index.ts` rather than copy-pasting.

## Architecture notes

- **Server vs client**: anything in `lib/server/` is server-only (DB, secrets, AI keys).
  Routes talk to it via `+server.ts` / `+page.server.ts` and `/api/*` endpoints.
- **Auth**: `hooks.server.ts` populates `locals.user`. Admin routes guard via `admin-guard.ts`.
- **AI config is DB-driven**, not env — admin sets provider/model/key in `/admin`
  (`ai_config` table). Safety: kill switch, token/cost caps, rate limit, per-user quota
  (`ai_limits`, `quota.ts`); usage logged to `ai_generations`; Telegram alerts on thresholds.
- **Paywall**: no active subscription → blocked, redirect to `/billing`. Midtrans webhook
  (`/api/billing/webhook`) flips `payments.status` → extends `subscriptions`. Admin can
  manual-activate (`/api/admin/activate`) as demo fallback.
- **Generate flow**: template form → `/api/projects/from-template` → single-shot generate →
  DOCX-JSON document; long docs assembled section-by-section server-side.

## Env

`DATABASE_URL`, `APP_URL`, `BREVO_API_KEY`, `EMAIL_FROM`, `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI`,
`MIDTRANS_SERVER_KEY/CLIENT_KEY`, `TELEGRAM_BOT_TOKEN/CHAT_ID`, `ADMIN_EMAIL`.
AI provider/key are **not** in env (DB-managed).

## Before committing

Run `bun run check` — must be 0 errors. Pre-existing warnings (TreeItem `svelte:self`,
a11y labels) are known; don't introduce new ones.
