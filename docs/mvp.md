# MVP Scope

Question MVP answers:
> Do students want AI that builds skripsi following their kampus template?

Keep small. Only what video demo needs.

## In scope

- Auth: register, login, logout, protect dashboard, forgot password, email verify, Google login, 
- Dashboard: list projects, status, quota left, new project
- Create project: nama, kampus, jenis dokumen, jurusan, ide, bahasa
- Templates: 3 kampus (Amikom, UGM, UNY) — struktur BAB + format
- AI generate: judul → outline BAB I–V → draft BAB I
- Editor: edit per section, save, regenerate
- Export DOCX: cover + BAB I + outline, format from template
- Payment: Midtrans gateway, custom payment page, quota limit
- AI: admin sets provider/key in admin dashboard, user just uses
- Admin: monitor AI usage, safety limits (kill switch/caps/rate),
  Telegram warnings

## Out of scope (later)

collab, 100 templates, recurring billing, auto invoice, upgrade/downgrade,
PDF polish, plagiarism, fine-tune, mobile/desktop app, Zotero/Mendeley

## Already built

projects/folders/documents CRUD, AI gen (OpenAI/Anthropic/Gemini),
DOCX export, chat, live preview.

> connector UI exists but gets removed → AI rebuilt as admin dashboard config.

## MVP gap (build this)

postgres migration · auth · kampus templates · guided judul→outline→BAB ·
quota tracking · Midtrans payment (custom page) + subscription ·
admin AI config + monitoring + safety limits + Telegram alerts
