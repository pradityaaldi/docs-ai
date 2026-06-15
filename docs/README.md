# Paperio — Project Docs

AI thesis writer. Pick kampus template → input idea → AI generate judul/outline/BAB → edit → export DOCX.

## Docs

- [mvp.md](./mvp.md) — MVP scope
- [todo.md](./todo.md) — task list, ordered (db → auth → app → payment → admin)
- [stack.md](./stack.md) — tech stack
- [database.md](./database.md) — schema
- [ai-admin.md](./ai-admin.md) — AI config, monitoring, safety, Telegram
- [roadmap.md](./roadmap.md) — phases after MVP

## MVP demo flow

```
login → dashboard → buat project → pilih kampus/template
→ input ide → AI judul → pilih → AI outline BAB I–V
→ AI BAB I → edit → export DOCX
```

## Order

1. Postgres (migrate from SQLite)
2. Auth
3. App (thesis flow + templates + editor + export)
4. Payment (Midtrans custom page + quota)
5. Admin (AI config + monitoring + safety + Telegram alerts)

Chase MVP. Skip anything not in demo flow.
