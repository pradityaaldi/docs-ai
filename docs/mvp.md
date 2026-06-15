# MVP Scope

Question MVP answers:
> Do users want AI yang bikin dokumen (skripsi, tugas, surat) ngikut template siap pakai?

Keep small. Only what video demo needs.

## Decisions (locked)

- **Goal**: Full MVP semua sprint (db → auth → app → payment → admin), autonomous.
- **Auth**: full — email/password + email verify + forgot password + Google OAuth.
  Email via **Brevo** (Sendinblue). Google OAuth: code pakai env placeholder, creds nyusul.
- **Doc types MVP**: skripsi · makalah/tugas kuliah · surat (izin sakit dll).
- **Template**: gallery bernama (Google Docs style) — mis. "Skripsi UGM",
  "Izin Cuti Amikom", "Makalah", "Surat Izin Sakit". User browse → pilih → isi form.
- **AI flow**: **single-shot**. Isi form → generate dokumen sekali jadi.
  No guided judul→outline→BAB picking. Dokumen panjang (skripsi) digenerate
  per-section di server, tetap 1 aksi user (1 klik generate).
- **Access**: **hard paywall** — wajib subscribe sebelum pakai. Admin bisa
  manual-activate buat demo/testing.
- **Demo hero**: multi-doc showcase (skripsi + makalah + surat).
- **Template specs**: cari di internet (struktur BAB, font, margin, spasi,
  format daftar pustaka per kampus).

## In scope

- Auth: register, login, logout, protect dashboard, **email verify, forgot
  password (Brevo), Google login**
- Dashboard: list projects, status, quota left, new project
- Template gallery: browse by kategori (akademik / surat), pilih template
- Create project: dari template → form fields (judul/ide, nama, jurusan, dll
  per template) + bahasa, store template_id
- AI generate: **single-shot** full document → DOCX JSON
- Editor: edit per section, save, regenerate
- Export DOCX: format from template (cover/kop, font, margin, spasi)
- Payment: Midtrans gateway, custom payment page, **hard paywall** + quota
- AI: admin sets provider/key in admin dashboard, user just uses
- Admin: monitor AI usage, safety limits (kill switch/caps/rate), Telegram warnings

## Out of scope (later)

proposal skripsi (BAB I–III), collab, 100 templates, recurring billing,
auto invoice, upgrade/downgrade, PDF polish, plagiarism, fine-tune,
mobile/desktop app, Zotero/Mendeley

## Already built

projects/folders/documents CRUD, AI gen (OpenAI/Anthropic/Gemini),
DOCX export, chat, live preview.

> connector UI exists but gets removed → AI rebuilt as admin dashboard config.
> guided multi-step gen (judul/outline/bab) replaced by single-shot template gen.

## MVP gap (build this)

postgres migration · full auth (Brevo email + Google OAuth) · template gallery
(skripsi/makalah/surat) · single-shot generate per template · quota tracking ·
Midtrans payment (custom page) + hard paywall + subscription ·
admin AI config + monitoring + safety limits + Telegram alerts
