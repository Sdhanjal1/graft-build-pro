# Quottr pre-launch audit

Read-only sweep of trader pages, customer portal, marketing routes, server functions and webhooks. No code changed. Items are ranked so you can pick what to ship before Friday.

## P0 — Blockers (fix before launch)

1. **IDOR on payment status** — `src/lib/payments.functions.ts:202` (`getQuotePaymentStatus`) filters only on `quote_id`. Any signed-in trader can read another trader's `invoice_payments` row. Add `.eq("user_id", context.userId)`.
2. `**supabaseAdmin` imported at module scope in 3 webhook routes** — `src/routes/api/public/payments/webhook.ts:3`, `connect-webhook.ts:3`, `hooks/service-reminders.ts:3`. Risk of `SUPABASE_SERVICE_ROLE_KEY` leaking into client bundle. Switch to `const { supabaseAdmin } = await import(...)` inside the handler.
3. **Branding bucket is public** — anything uploaded is world-readable. Keep public only if it's strictly logos; otherwise switch to private + signed URLs.

## P1 — High (should fix this week)

4. **Subscription Stripe key ignores sandbox flag** — `src/lib/subscription.functions.ts:9` always prefers the live key, while `payments.functions.ts` respects `VITE_PAYMENTS_MODE`. In sandbox you'll mix real Stripe customers with test sessions.
5. **No `errorComponent` on signed-in routes** — `app.tsx`, `quotes.index/$quoteId`, `chaser`, `clients.*`, `messages`, `notifications`, `settings`, `invoices.$quoteId`. A network blip = blank screen.
6. **No `notFoundComponent` on most list routes** — same files. Any `notFound()` from a loader renders nothing.
7. **Auth gate runs in `useEffect**` — `app.tsx:91`, `onboarding.tsx:51`, `settings.tsx`. Signed-out users see a flash of skeleton/content before redirect. Move under a shared `_authenticated/` layout with `beforeLoad`.
8. **Balance payments not supported from client hub** — `createPortalCheckoutFromCode` enum is `"deposit" | "full"` only. Customers paying the balance via `/portal/c/$code` hit a validation error.
9. `**og:image` typo in `__root.tsx**` — `property: "n"` instead of `og:image`. Same typo in `portal.c.$code.tsx`. Every WhatsApp/iMessage share is image-less. Marketing pages (`index`, `pricing`, `features`, `faqs`, `about`) also have no `og:image`.
10. `**/auth` indexable** — no `head()`, no `robots: noindex`. Google can index the sign-in page.
11. **Missing `og:type` on marketing heads** — `pricing`, `features`, `faqs`, `about`.

## P2 — Medium

12. **Trader app reads mutable in-memory mocks** — `src/lib/user-data.ts` hydrates `mockQuotes`/`userClients` once. Stale across tabs; webhook flips don't reflect until reload. Add realtime on `quotes` or migrate lists to `useQuery` with refetch-on-focus.
13. `**clients.$clientId` not-found** is bare text with no nav.
14. `**request.$proId.tsx` & `confirmed.tsx**` have no `head()` — share cards show generic marketing OG instead of the pro's name.
15. `**quotes.index` search input** has no `aria-label`.
16. **Service-reminders cron** sends push to traders whose subscription is cancelled/expired — no join on `subscriptions.status`.
17. `**startSubscriptionCheckout**` does not call `assertAllowedReturnUrl()` on success/cancel URLs → open-redirect.
18. `**trades.tsx` parent layout** has no `head()` — `/trades` directory page loses SEO.
19. **SECURITY DEFINER fn executable by signed-in users** (Supabase linter) — review `is_admin` / `has_role` exposure; revoke EXECUTE from `authenticated` if not intended.

## P3 — Polish

20. `pricing.tsx` title uses comma not em-dash (inconsistent with other pages).
21. `auth.tsx` password input missing `autocomplete="current-password" / "new-password"`.
22. `onboarding.tsx` inputs rely on placeholder, no `<label>`.
23. `SaveIndicator` lacks `aria-live="polite"`.
24. `portal.$token.tsx` loading spinner has no text fallback.
25. PDF download in `invoices.$quoteId.tsx` swallows errors silently — no toast.
26. `q.$code.tsx` short-link uses 307; 302 is correct for GET redirects.
27. `pg` extension in public schema (Supabase linter warn).

## Recommended fix order

```text
Phase 1 (before publish):  P0-1, P0-2, P0-3, P1-4, P1-8, P1-9
Phase 2 (same week):       P1-5/6/7, P1-10, P1-11, P2-16, P2-17
Phase 3 (post-launch):     all P2 remaining + P3 polish
```

## Next step

Tell me which phase to implement and I'll do it in one batch. If you want a specific subset (e.g. "just the P0s and the og:image typo"), name the numbers.

Pre-launch fixes from the audit — but I've VERIFIED each against the code first. Fix the

confirmed-real items below. Do NOT action the ones I've marked as already-handled/false.

Surgical changes only; this is money/auth code right before a native wrap.

=== FIX THESE (verified real) ===

P1-8 — BALANCE PAYMENT BROKEN FROM CLIENT HUB (real money bug, highest priority here).

createPortalCheckoutFromCode (payments.functions.ts ~line 451) accepts requestType

z.enum(["deposit","full"]) only — no "balance". So a customer paying their BALANCE via the

/portal/c/$code hub link hits a validation error and cannot pay. The main portal path

(~line 225) already includes "balance". FIX: add "balance" to the createPortalCheckoutFromCode

enum and make sure the balance branch computes the correct balance amount (total minus deposit

already paid), mirroring how the main portal path handles "balance". Test: pay a balance via a

/portal/c/$code link end to end.

P1-17 / open-redirect — startSubscriptionCheckout does NOT validate its success/cancel return

URLs, while the rest of the app uses an assertAllowedReturnUrl() / ALLOWED_RETURN_ORIGINS check.

FIX: apply the same assertAllowedReturnUrl() (or the ALLOWED_RETURN_ORIGINS allowlist already in

payments.functions.ts) to the subscription checkout success_url and cancel_url, so they can't be

pointed at an arbitrary external domain. Same pattern, just applied consistently.

P1-4 — SUBSCRIPTION STRIPE KEY IGNORES SANDBOX FLAG. subscription.functions.ts (~line 9) always

prefers the live key, while payments.functions.ts respects VITE_PAYMENTS_MODE. In sandbox this

mixes real Stripe customers with test sessions. FIX: make subscription.functions.ts use the SAME

env-resolution pattern as getStripeEnv() in payments.functions.ts (sandbox only when explicitly

flagged, live as the fail-safe default). This is the same family as the connect.functions.ts 1f

fix already done — mirror that.

P0-1 — DEFENCE-IN-DEPTH on getQuotePaymentStatus (payments.functions.ts ~line 202). It filters

only on quote_id. NOTE: this is NOT an active breach — it uses the user-scoped context.supabase

client and invoice_payments has RLS enabled, so other traders' rows are already blocked at the

database. But add .eq("user_id", context.userId) anyway as explicit defence-in-depth and clearer

intent. One line.

=== STRONG POLISH — do if quick, not blockers ===

P1-5/6 — No errorComponent / notFoundComponent on signed-in routes (app.tsx, quotes.index,

quotes.$quoteId, chaser, clients.*, messages, notifications, settings, invoices.$quoteId). A

network blip currently shows a BLANK screen — bad for a money app used on-site with patchy signal.

Add a simple shared error + not-found component (a "Something went wrong / tap to retry" card) to

these routes. Reuse one component, don't write per-route.

P1-9 (valid half only) — Marketing pages (index, pricing, features, faqs, about) are missing

og:image in their head(). Add og:image pointing to the existing [https://quottr.co.uk/og-quottr.jpg](https://quottr.co.uk/og-quottr.jpg)

so shared links show the brand image. (This matters for WhatsApp/iMessage sharing.)

=== DO NOT ACTION (verified already-handled or false) ===

- P0-9 "og:image typo (property: 'n')" — FALSE. __root.tsx and portal.c.$code.tsx already have

  property: "og:image" correctly. Do not change these.

- P0-3 branding bucket — already addressed in today's security pass; bucket is intentionally

  public for logos (embedded in invoices/emails), writes are per-user scoped. Leave as-is.

- P0-2 supabaseAdmin import — these are .server files in server-only route handlers, not client

  components. Instead of refactoring, just CONFIRM the SUPABASE_SERVICE_ROLE_KEY does not appear

  in the client bundle and report — only change if it actually leaks.

Confirm typecheck clean. Report back per item: changed (what) vs verified-only.

&nbsp;