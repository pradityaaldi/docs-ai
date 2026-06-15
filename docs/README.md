# Paperio — Project Docs

AI document generator. Pilih template (Google-Docs style gallery) → isi form
→ AI generate dokumen full (single-shot) → edit → export DOCX.

Bukan cuma skripsi. MVP doc types: **skripsi · makalah/tugas · surat (izin sakit dll)**.
Template gallery bernama & extensible ("Skripsi UGM", "Izin Cuti Amikom", "Makalah", …).

## Docs

- [mvp.md](./mvp.md) — MVP scope + decisions (locked)
- [todo.md](./todo.md) — task list, ordered (db → auth → app → payment → admin)
- [stack.md](./stack.md) — tech stack
- [database.md](./database.md) — schema
- [ai-admin.md](./ai-admin.md) — AI config, monitoring, safety, Telegram
- [roadmap.md](./roadmap.md) — phases after MVP

## MVP demo flow

```
login → dashboard → pilih template (gallery)
→ isi form → AI generate dokumen (single-shot)
→ edit → export DOCX
```

Demo hero: **multi-doc showcase** — tunjukin skripsi + makalah + surat.

## Order

1. Postgres (migrate from SQLite)
2. Auth (full: email/password + verify + forgot + Google OAuth)
3. App (template gallery + single-shot generate + editor + export)
4. Payment (Midtrans custom page + hard paywall + quota)
5. Admin (AI config + monitoring + safety + Telegram alerts)

## Goal (locked)

Chase **Full MVP** (Sprint 0–7) autonomous, lapor tiap sprint kelar.
Skip anything not in MVP scope. See [mvp.md](./mvp.md#decisions-locked).
