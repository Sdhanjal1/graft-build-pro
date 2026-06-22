# Quottr — Tech Stack & Service Inventory

Single source of truth for every external service this app depends on.
When something breaks "for no reason", check this file first.

The live status of each service is also visible at **`/ops/stack`** (admin only).

---

## AI

### Anthropic (Claude)
- **Used by:** `src/lib/ai-capture-quote.functions.ts`, `src/lib/ai-quote.functions.ts`
- **Purpose:** Parses voice transcript → structured quote JSON
- **Secret:** `ANTHROPIC_API_KEY`
- **Top up:** https://console.anthropic.com/settings/billing
- **Failure symptom:** Voice quote silently fails after recording. Logs: `"credit balance is too low"`.
- **Fallback:** Migrate both calls to Lovable AI Gateway (uses `LOVABLE_API_KEY`, billed via Lovable credits).

### OpenAI (Whisper)
- **Used by:** `src/lib/transcribe.functions.ts`
- **Purpose:** Speech-to-text for the voice recorder
- **Secret:** `OPENAI_API_KEY`
- **Top up:** https://platform.openai.com/account/billing
- **Failure symptom:** Recording finishes but transcript never appears. Logs: `401` or `insufficient_quota`.

### Lovable AI Gateway
- **Used by:** (no direct callers today — available as fallback)
- **Purpose:** Unified gateway for Claude / Gemini / GPT, billed via Lovable credits
- **Secret:** `LOVABLE_API_KEY` (auto-provisioned by Lovable)
- **Top up:** Lovable workspace → Settings → Plans & credits
- **Failure symptom:** `402` credit exhausted, `429` rate-limited.

---

## Payments

### Stripe — Subscriptions (Quottr revenue)
- **Used by:** `src/lib/subscription.functions.ts`, `src/routes/api/public/payments/webhook.ts`
- **Purpose:** £29/mo trader subscriptions
- **Secrets:** `STRIPE_LIVE_API_KEY`, `STRIPE_SANDBOX_API_KEY`, `PAYMENTS_LIVE_WEBHOOK_SECRET`, `PAYMENTS_SANDBOX_WEBHOOK_SECRET`
- **Dashboard:** https://dashboard.stripe.com
- **Failure symptom:** Trial → paid conversions stop; webhooks 401 in logs.

### Stripe Connect (trader invoice payments)
- **Used by:** `src/lib/connect.functions.ts`, `src/lib/payments.functions.ts`, `src/routes/api/public/payments/connect-webhook.ts`
- **Purpose:** Customers pay trader invoices; Quottr takes 0.5% platform fee
- **Secrets:** `STRIPE_BYOK_SECRET_KEY`, `STRIPE_CONNECT_CLIENT_ID`, `STRIPE_CONNECT_WEBHOOK_SECRET`, `STRIPE_CONNECT_SANDBOX_WEBHOOK_SECRET`
- **Verify:** `/ops` → "Stripe Connect client id" panel
- **Failure symptom:** "Pay by card" link fails on portal; new traders can't complete onboarding.

---

## Email

### Resend
- **Used by:** `src/lib/email/send-invoice.server.ts`, `src/lib/invoice-email.server.ts`, `src/lib/notifications.server.ts`
- **Purpose:** Sends quotes, invoices, magic links, notifications
- **Secret:** `RESEND_API_KEY`
- **Top up:** https://resend.com/settings/billing
- **Failure symptom:** Sending a quote succeeds in UI but customer never receives it; logs show `403` or `domain not verified`.

---

## Push notifications

### Web Push (VAPID)
- **Used by:** `src/lib/push.functions.ts`, `src/lib/web-push.server.ts`, `src/lib/push.server.ts`
- **Purpose:** Browser push for paid invoices, new quote requests
- **Secrets:** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- **Top up:** Self-hosted — no billing. Keys are permanent.
- **Failure symptom:** Push subscriptions return `410 Gone` (key rotated) or never deliver.

---

## Infrastructure

### Lovable Cloud (Supabase)
- **Used by:** Everything — DB, Auth, Storage
- **Secrets:** `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Top up:** Lovable workspace → Cloud → Overview → Advanced settings (instance size)
- **Failure symptom:** All DB queries time out; auth fails.

### Cloudflare Workers (runtime)
- **Used by:** `src/server.ts`, every server function and route
- **Purpose:** SSR + server function execution
- **Billing:** Handled by Lovable (included in plan)
- **Failure symptom:** App returns the branded 500 page; check Cloudflare logs.

### Cron — service reminders
- **Used by:** `src/routes/api/public/hooks/service-reminders.ts`
- **Secret:** `CRON_SECRET`
- **Failure symptom:** Service reminder emails stop firing.

---

## Quick top-up checklist (in priority order)

1. **Anthropic** — voice quotes break first when this runs out
2. **OpenAI** — voice quotes also break
3. **Resend** — invoices stop reaching customers
4. **Stripe** — payments stop; usually only fails on key rotation, not balance
5. **Lovable AI / Cloud credits** — only matters once Anthropic/OpenAI are migrated
