## Goal

One place to see **every external service this app depends on**, who pays for it, where to top it up, and whether it's currently healthy — so a dead Anthropic balance or expired Stripe key never silently breaks voice quotes, payments, or emails again.

Two deliverables, kept in sync:

1. **`docs/STACK.md`** — a static reference doc (the source of truth)
2. **`/ops/stack`** — an in-app dashboard tile (admin-only) that live-checks each service

---

## 1. `docs/STACK.md` — the inventory

A single markdown file grouping every dependency by category. For each service: what it does, which code paths use it, which secret name, where to manage billing / top up, and the failure symptom users see when it dies.

Categories (based on what's actually in the codebase today):

- **AI** — Anthropic (ai-capture-quote, ai-quote), OpenAI Whisper (transcribe), Lovable AI Gateway
- **Payments** — Stripe Connect (payments.functions, webhooks), Stripe subscriptions
- **Email** — Resend (invoice-email, notifications)
- **Push** — web-push / VAPID
- **Infra** — Lovable Cloud (Supabase: DB, Auth, Storage), Cloudflare Workers (runtime)
- **Frontend deps with quotas** — fonts, map tiles if any

Example row format:

```text
### Anthropic
Used by:   src/lib/ai-capture-quote.functions.ts, src/lib/ai-quote.functions.ts
Purpose:   Parses voice transcript -> structured quote
Secret:    ANTHROPIC_API_KEY
Top up:    https://console.anthropic.com/settings/billing
Symptom:   Voice quote fails after recording; logs show "credit balance too low"
Fallback:  Migrate to Lovable AI Gateway (LOVABLE_API_KEY, no top-up needed)
```

---

## 2. `/ops/stack` — live health dashboard

A new tab on the existing admin `/ops` route. Shows the same inventory but with a live status pill per service: **OK / Degraded / Down / Unknown**.

Implementation:

- New server fn `getStackHealth` (in `src/lib/ops.functions.ts`) gated by the existing admin role check.
- For each service, run a cheap probe in parallel:
  - **Anthropic** — `GET /v1/models` with the key (returns 401 if dead-but-valid, 200 if funded)
  - **OpenAI** — `GET /v1/models`
  - **Lovable AI Gateway** — small `models` list call
  - **Stripe** — `GET /v1/balance` (also surfaces the available cash balance)
  - **Resend** — `GET /domains`
  - **Supabase** — `select 1` via admin client
  - **Web Push** — verify VAPID env vars are present (no remote probe)
- Each probe wrapped with a 3s timeout; failures captured, never thrown.
- Returns `{ service, status, message, lastChecked, topUpUrl, docsAnchor }`.

UI: a new `src/routes/ops.stack.tsx` (child of `/ops`) renders rows grouped by category, with a "Recheck" button and a link to the matching `docs/STACK.md` anchor for each row.

Optional follow-up (not in this plan): nightly cron via `/api/public/hooks/stack-health` that emails you when any probe flips to Down.

---

## What this plan does NOT change

- No migration of Anthropic -> Gateway (separate decision, still pending from previous turn)
- No changes to existing voice/quote/payment logic
- No new secrets — uses what's already configured
- No public exposure — `/ops/stack` reuses the existing admin gate

---

## Files

New:
- `docs/STACK.md`
- `src/routes/ops.stack.tsx`

Edited:
- `src/lib/ops.functions.ts` — add `getStackHealth` server fn
- `src/routes/ops.tsx` — add "Stack" tab/link

---

## Acceptance

- Opening `/ops/stack` shows every external service with a current status pill.
- Each row links to its provider billing page and to the matching section in `docs/STACK.md`.
- Killing the Anthropic key locally flips its pill to Down within one recheck.
- `docs/STACK.md` lists every secret name currently in the project with no orphans.
