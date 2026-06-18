## Quottr Ops Dashboard — `/ops`

Schema-verified against the live DB. Admin-only, read-only, desktop layout, lives outside the mobile `AppShell`.

## Order of work

1. **Migration A — access gate + fee column + errors table** (single migration, awaits approval)
2. **Server fee capture** in the existing webhook
3. **Error-log helper** + two initial call sites
4. **Admin-gated data server fn**
5. **`/ops` desktop page** consuming it

## 1. Migration A

- `profiles.is_admin boolean NOT NULL DEFAULT false`
- `UPDATE profiles SET is_admin = true WHERE id = auth.uid()` — won't work from a migration; instead the migration takes the admin user id as a literal. **Need from you: the email address of your admin account**, or I'll add a one-line `UPDATE profiles SET is_admin = true WHERE email = '<you>'` you can edit.
- `invoice_payments.platform_fee_cents integer NULL` (nullable so historical rows stay untouched; UI labels missing rows as estimated).
- New table `public.error_events (id uuid pk, user_id uuid null references auth.users on delete set null, context text not null, message text not null, created_at timestamptz default now())` with GRANTs (`service_role` ALL; no `anon`/`authenticated` — only server functions read/write it via service role), RLS enabled, no policies (locked to service role). Index on `created_at desc`.
- New SECURITY DEFINER function `public.is_admin(_uid uuid) returns boolean` reading `profiles.is_admin` — used by the auth gate so we never read `profiles` from the client side with a wide grant.

## 2. Webhook fee capture

In `src/routes/api/public/payments/webhook.ts` (and the shared webhook helper in `src/lib/payments-webhook-shared.server.ts`), on the Connect `checkout.session.completed` / `payment_intent.succeeded` path, read `application_fee_amount` from the Stripe object (PaymentIntent → `application_fee_amount`, or the Charge's `application_fee_amount`) and persist it to `invoice_payments.platform_fee_cents` alongside the existing `status = 'paid'` update. Only writes when present; historical rows stay null.

## 3. Error logging helper

`src/lib/ops-errors.server.ts` — `logErrorEvent({ userId?, context, message })` using `supabaseAdmin`. Best-effort: swallow its own failures so it can never break the caller.

Wire two call sites now:
- Webhook failure path in `src/routes/api/public/payments/webhook.ts` (anywhere we currently return non-200 or catch).
- Voice-AI failure path in `src/lib/ai-capture-quote.functions.ts` (or `transcribe.functions.ts` — whichever currently has the `catch` that surfaces "voice failed" to the UI; I'll wire whichever is the real failure path).

## 4. Admin-gated server fn

`src/lib/ops.functions.ts` → `getOpsDashboard`:

- `.middleware([requireSupabaseAuth])`
- First line: `const { data: ok } = await supabase.rpc('is_admin', { _uid: userId }); if (!ok) throw new Error('Forbidden');`
- Then loads `supabaseAdmin` (dynamic import) and runs all the queries below in parallel.
- Returns one typed object: `{ revenue, gmv, activation, health, recentErrors, recentSignups }`.

A sibling fn `getIsAdmin` (same shape, returns boolean) backs the route's client-side redirect — the real gate is in `getOpsDashboard`.

### Queries (verified columns)

PRICE = £29 constant in code.

- **Revenue**
  - `active`, `trialing`, `past_due`, `canceled` counts from `subscriptions` (env = live; sandbox excluded).
  - `mrr_pence = active * 2900`.
  - Trial→paid conversion: `count(status in ('active','past_due','canceled') AND trial_end < now()) / count(trial_end < now())`.
  - `platform_fees_pence = sum(coalesce(platform_fee_cents, round(amount_cents * 0.005))) where status='paid'`, plus a flag `fees_partly_estimated = exists(... where status='paid' and platform_fee_cents is null)`.
  - `total_revenue_pence = mrr_pence + platform_fees_pence`.

- **GMV** — `invoice_payments` where `status='paid'`: total, last 7d, last 30d (by `paid_at`); `distinct user_id` for activated traders; `avg(amount_cents)`; `payments_per_active = count / distinct_users`.

- **Activation** — `profiles`: total, new 7d, new 30d. `activated = profiles with ≥1 quote`. First-quote-within-24h: join `profiles → min(quotes.created_at) per user`, compare to `profiles.created_at`. Quote funnel: `quotes` counts by status: draft (`pending`), sent, accepted, paid.

- **Health** — `subscriptions` past_due count; `invoice_payments` status='failed' count; `profiles` where `stripe_connect_account_id is not null and stripe_connect_charges_enabled=false`; `quote_requests` where `read_at is null` (cold leads).

- **Recent errors** — `error_events` order by `created_at desc` limit 20, joined to `profiles.business_name`/`email` for display.

- **Recent signups** — `profiles` order by `created_at desc` limit 20, with `trade_type` and a boolean `has_sent_quote = exists(quotes where user_id = p.id and status in ('sent','accepted','paid','completed','overdue'))`.

## 5. `/ops` page

New file `src/routes/ops.tsx`:

- Top-level route (NOT under `_authenticated`) but with `beforeLoad` that calls `getIsAdmin` and redirects to `/app` if false. The data fn re-checks server-side, so a forged client cannot exfiltrate.
- Renders a desktop shell (no `AppShell`, no `BottomNav`): max-w-7xl, paper background, header strip with title + "Live data" timestamp.
- Sections as the spec: Revenue (hero MRR in Bebas, supporting stat cards), GMV (clearly labelled "Volume processed — not Quottr revenue"), Activation, Health.
- Panel A: Recent errors table (time / context / message / user).
- Panel B: Recent signups list (time / trade / business name / "Sent first quote ✓" or "—").
- Reuses `card-surface`, `font-display`, `text-lime`, etc. No new tokens.
- Loads via TanStack Query (`ensureQueryData` in the loader, `useSuspenseQuery` in component) so it's snappy and refetchable.

## Out of scope (per your "don't touch app screens")

No edits to existing user-facing screens. The only edits to existing files are the webhook handler (fee capture) and the two error log call sites.

## One thing I need from you before migrating

Your admin email (the account that should be flipped to `is_admin = true`). Reply with the email and I'll bake it into the migration.
