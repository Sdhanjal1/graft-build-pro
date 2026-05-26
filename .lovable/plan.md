# Project Health Scan — Quottr

Ran the security scanner, Supabase linter, dependency audit, and a code-quality sweep. The app is in solid shape — no critical vulnerabilities, no exposed secrets, RLS is correctly scoped, dependencies are clean. Below are the issues worth acting on, grouped by priority.

---

## 🟠 Should fix (security warnings)

### 1. Unauthenticated portal endpoints have no rate limiting
**Files:** `src/lib/portal.functions.ts`, `src/lib/messages.functions.ts`
`postClientPortalMessage` and `postPortalMessage` are public (by design — customers use them from the portal link) but accept unlimited submissions per token/code. A bad actor who guesses or harvests one portal code could:
- Flood a tradesperson's inbox + push notifications
- Run amplification attacks against your push-notification budget
- Enumerate valid codes via response timing/errors

**Fix:** Add a simple server-side rate limit (e.g. max 5 messages/minute per token + per IP) using a small Postgres table with `pg_cron` cleanup. Also return identical error text for invalid vs expired vs disabled codes to block enumeration.

### 2. Raw upstream AI error text leaked to the browser
**Files:** `src/lib/ai-quote.functions.ts`, `src/lib/extract-jobs.functions.ts`
Errors like `Claude API error (500): <200 bytes of vendor body>` are re-thrown to the client. Today that's only model/quota metadata, but if a future regression puts a key fragment in an error body it would ship straight to the browser.

**Fix:** `console.error` the raw error server-side, throw a sanitized `"Could not generate quote. Please try again."` to the client. Keep the user-friendly 429/402 messages already in place.

### 3. Supabase extension installed in `public` schema
Supabase linter warning (`0014_extension_in_public`). Low risk, best-practice cleanup — move the extension to a dedicated schema per the [Supabase docs](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public). Requires a migration.

---

## 🟡 Nice to clean up (not urgent)

- **`src/routes/welcome.tsx`** is a 7-line redirect to `/onboarding`. Either delete it and update any inbound links, or keep it but it's dead weight.
- **`as any` / `: any` appears 82 times** across `src/`. Not breaking anything, but worth tightening in the larger files (`quotes.new.tsx`, `quotes.$quoteId.tsx`, `settings.tsx`) as you touch them.
- **Large route files** — `quotes.new.tsx` (1048 lines), `quotes.$quoteId.tsx` (944 lines), `settings.tsx` (618 lines), `portal.c.$code.tsx` (577 lines). Working fine, but each is a refactor candidate when you next iterate on those screens (split sub-components into their own files).
- **40 `console.log/warn/error` calls** in app code. Fine for `console.error` in catch blocks; consider stripping stray `console.log` debug calls.

---

## ✅ Clean — no action needed

- **Dependencies:** no high/critical CVEs.
- **RLS policies:** every user table is `auth.uid() = user_id` scoped; `invoice_payments` and `subscriptions` correctly block all client writes (Stripe webhooks only).
- **Secrets:** all sensitive keys (Stripe, Anthropic, OpenAI, VAPID, service role) are in Supabase Secrets, none in code.
- **Auth:** `requireSupabaseAuth` + `requireActiveSubscription` middleware in place on protected server fns.
- **Public portal** endpoints correctly avoid exposing PII beyond what the customer needs.

---

## Suggested next step

If you want, I can implement fixes #1 and #2 (rate limiting + sanitized AI errors) in one pass — they're the only findings with real security impact. #3 is a small Supabase migration I can bundle in. The "nice to clean up" items are best done opportunistically as you work on those areas.

Want me to go ahead with #1 + #2 + #3?
