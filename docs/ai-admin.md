# AI Admin, Monitoring & Safety

AI fully controlled by admin. User never sees config — just generates.

## 1. AI config (admin dashboard)

Admin page sets active AI connection → `ai_config` table.

- provider: openai / anthropic / gemini
- api_key, model, base_url
- test button (verify before save)
- is_active (one active at a time)

User generate calls read active `ai_config`. No env, no user UI.

## 2. Monitoring (admin dashboard)

Every generate writes `ai_generations`: tokens, cost, status, latency.

Admin views:
- total tokens / cost today, this month
- per-user usage (top users)
- error rate, avg latency
- generate count by type (judul/outline/bab)

## 3. Safety system (`ai_limits`)

Guard before each generate. Block if any breached.

- **kill switch** — `enabled=false` → disable all AI instantly
- **global daily token cap**
- **global monthly cost cap**
- **per-user daily cap** (extra layer over plan quota)
- **rate limit** — req/min per user
- **max tokens per request**

Check flow:
```
user clicks generate
↓
load ai_limits
↓
kill switch off? quota ok? rate ok? under caps?
↓ no  → block + message
↓ yes → call AI → log usage → recheck caps
```

## 4. Telegram alerts

Bot sends warnings to admin chat. Creds in env
(`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`). Log to `alerts`.

Trigger when:
- usage hits `warn_threshold_pct` (e.g. 80% of daily/monthly cap)
- cap reached → AI auto-paused
- error spike (many failed generates in short window)
- single user abuse (over per-user cap repeatedly)
- AI provider down / auth fail

Message example:
```
⚠️ Paperio: daily token 80% (40k/50k). User spike: budi@x.com.
```

Debounce — don't spam same alert. One per threshold per day.
