# Voice Quote → Customer Paid — Pre-Wrap Audit

41 findings across the full cycle. Grouped by severity so you can decide what blocks the Capacitor wrap and what can wait.

No code changes proposed here — this is the audit you asked for. Approve and I'll come back with a tight fix plan for whichever tier you want to clear.

## Tier 1 — Fix before wrap (data integrity / silent money bugs)

These either corrupt DB state, lose money signals, or fail silently in production. Wrap or no wrap, they need to go.

1. **Duplicate quote refs** — `quote-ref.functions.ts:22` SELECT MAX + 1 with no lock, no retry on 23505. Two concurrent "Send" clicks → one quote save throws an unhandled Postgres error.
2. **Receipt email skipped when PI event arrives before session-completed** — `payments-webhook-shared.server.ts:165` early `return` on `existingByPi` bypasses the email/push block on first event.
3. `**paid_at` / `deposit_paid_at` never written to `quotes**` — `payments-webhook-shared.server.ts:281`. Deposit → `accepted` with no `deposit_paid_at`; full/balance → `paid` with no `paid_at`. UI reads these fields elsewhere.
4. **Accept/decline race, no row lock** — `portal.functions.ts:195` + `messages.functions.ts:302`. SELECT-then-UPDATE guard; duplicate taps can both pass.
5. **Two unauthenticated accept endpoints, different guards** — token path skips `portal_visible` check; portal-code path enforces it. A hidden quote can still be accepted via token.
6. **Deposit fallback duplicated in two places** — `payments.functions.ts:277` uses `DEFAULT_DEPOSIT_FRACTION`; `portal.$token.tsx:253` uses literal `0.3`. Will drift the day the constant changes; UI vs charge mismatch.
7. **Platform + Connect webhook double-processing risk** — `webhook.ts` and `connect-webhook.ts` both handle `checkout.session.completed`. All sessions today are created with `Stripe-Account` so fire on Connect, but the platform handler isn't gated and would double-process if Stripe ever fans out.
8. **Invoice email mode inference fallback emits a full invoice for a deposit** — `invoice-email.server.ts:79`. Safe only as long as every webhook caller passes `mode` explicitly; one missed call site = wrong customer email.
9. **Invoice due-date fallback uses send-time + 14d, not quote date** — `invoice-email.server.ts:136`. Late-sent invoice shows a contractually wrong due date.
10. **Base64 size cap counts characters, not bytes** — `transcribe.functions.ts:9`. Rejects legitimate ~7.5 MB audio with a cryptic Zod error.
11. **AI capture JSON regex is greedy** — `ai-capture-quote.functions.ts:238`. Trailing prose from Claude → superset object parsed into the schema with garbage fields.

## Tier 2 — Fix soon (correctness, but lower blast radius)

12. Client-hub portal (`/portal/c/$code`) has **no balance-payment path** — `payments.functions.ts:444` only accepts `deposit | full`. Balance is unreachable via card from the hub.
13. Portal balance figure is client-computed from deposit fallback, not server-authoritative — `portal.$token.tsx:283`. Can differ from what Stripe actually charges.
14. Stale Connect session reuse — `payments.functions.ts:323`. If pro re-onboarded, the cached `session_id` 404s; catch swallows; old pending row left behind.
15. Non-Stripe payment events have **no idempotency gate** — `payments-webhook-shared.server.ts:136`. Replays duplicate paid rows, emails, push.
16. Missing `?env=` query param silently uses sandbox secret — `webhook.ts:9`.
17. Chaser "you are owed" sums `q.total`, ignoring deposits already received — `chaser.tsx:47`.
18. Chaser overdue date math treats `YYYY-MM-DD` as UTC midnight — `chaser.tsx:30`. UK quotes due "today" show as 1 day overdue all morning.
19. `ensurePortalToken` uses user-scoped client; existing-token lookup may always return null → **unbounded token row growth** — `messages.functions.ts:19`.
20. Pre-TTL portal codes never expire (`portal_issued_at` null short-circuits the guard) — `portal.functions.ts:45`.
21. Receipt path can email `£0 paid` if double-recorded deposit underflows — `invoice-email.functions.ts:37`.
22. Resend email send has no retry/timeout — `send-invoice.server.ts:187`. Transient 5xx → permanent "failed" status.
23. `invoice-amounts.ts:62` returns `balanceDueCents = total` when caller omits `depositPaidCents`. Footgun for any new caller.
24. `autoPay` effect in portal keys off "most recent paid" row — `portal.$token.tsx:155`. Edge case where balance row is most-recent breaks auto-fire; reverse case risks second balance checkout.
25. `SendQuoteDialog` Send button has no in-flight disabled state — `SendQuoteDialog.tsx:66`. Double-tap → duplicate token + duplicate status flips.
26. `setQuoteStatus` failure swallowed in SendQuoteDialog → quote stays `pending` in DB while UI says sent; chaser never fires.
27. `normalizeLineItems` can silently drop manually-typed labour lines with no category — `quotes.new.tsx:63`.
28. `extract-jobs` empty-result throws raw Zod error, no friendly fallback — `extract-jobs.functions.ts:63`.
29. `payment_webhook_audit` idempotency: shared query builder reuse pattern in subscription handler is fragile — `webhook.ts:158`.
30. `depositPaidCentsForEmail` computed after balance row already inserted; rapid replay can inflate "deposit credited" line — `payments-webhook-shared.server.ts:325`.

## Tier 3 — Polish / hardening

31. Transcribe extension detection chain is order-dependent on `audio/mp4;codecs=mp4a.40.2` — `transcribe.functions.ts:25`.
32. AI capture has no input-length guard; very large jobs hit Claude's 200k input cap with a raw API error instead of a clean truncation path — `ai-capture-quote.functions.ts:204`.
33. Pricing-pattern upsert is N sequential writes, no transaction; mid-loop failure leaves history half-updated — `pricing-patterns.functions.ts:124`.
34. Pricing-pattern rolling-average has a select-then-update TOCTOU — `pricing-patterns.functions.ts:117`.
35. `crypto.randomUUID()` + `Math.random()` suffix mixes CSPRNG and PRNG for token entropy — `messages.functions.ts:29`. UUID alone is fine; the suffix degrades it.
36. `/q/$code` resolver: namespace collision between client `portal_code` and quote `token` redirects wrong — `q.$code.tsx:16`.
37. Pay-online link in email only checks local `expires_at`, not `togglePortalActive` revocation — `invoice-email.server.ts:150`.
38. Email-status secondary update failure swallowed in outer catch — `invoice-email.server.ts:207`.
39. `createInvoiceCheckout` vs `createPortalCheckout` validate `quoteId` with different min/max; non-UUID passes both and fails at DB layer with a cryptic error.
40. `getClientPortalData` allows `code` up to 64 chars; `postClientPortalMessage` caps at 32. 32-char codes from `regeneratePortalCode` work; future longer codes would silently fail on message post.
41. `ai-capture-quote.functions.ts:155` casts `context as any` — middleware shape change becomes a runtime error, not a build error.

## Recommendation

Clear **Tier 1** (11 items) before wrapping. They're the ones that lose money signals, silently mis-email customers, or corrupt the status machine — and they're all small, localised fixes. Tier 2/3 can ship in a follow-up sprint after the native shell is live.

Tell me which tier(s) to plan fixes for and I'll produce a concrete, file-by-file patch plan next.

Pre-wrap Tier 1 fixes. I had the app audited; I've since VERIFIED each finding against the

code. Below is the corrected scope — fix the confirmed items, and for the items marked

VERIFY-ONLY do NOT rewrite working code, just confirm the existing mitigation. No behaviour

changes beyond what's listed. These are money/auth/data-integrity fixes, so keep each change

minimal and pass the existing money-correctness regression suite.

=== FIX THESE (confirmed real) ===

#5 — AUTH BUG (highest priority). The token-based accept/decline path in

messages.functions.ts (~line 276+, "customer accepts or declines a quote (token-based)")

updates quote status WITHOUT checking portal_visible, while the portal-code path in

portal.functions.ts (~line 200) correctly enforces .eq("portal_visible", true). A quote the

trader has hidden from the portal can still be accepted via its token link. FIX: add the same

portal_visible = true guard to the token path before allowing accept/decline; if not visible,

reject the same way the code path does.

#6 — DEPOSIT FALLBACK DRIFT. portal.$token.tsx:258 uses the literal 0.3 for the deposit

fraction, while payments.functions.ts (lines 284, 493) uses the DEFAULT_DEPOSIT_FRACTION

constant from @/lib/payment-timing. FIX: import and use DEFAULT_DEPOSIT_FRACTION in

portal.$token.tsx instead of the literal 0.3, so the portal UI can never drift from the actual

charge.

#2 — RECEIPT EMAIL SKIP. In payments-webhook-shared.server.ts, the paymentIntent branch

(~line 235, existingPi) early-returns after marking paid, on the assumption "the original

session already fired email + push." That assumption fails if a PI row exists that never went

through the email path (PI event arriving before/without the session-completed email). FIX:

before the early return, check whether the email/push was actually sent for this row (e.g. a

sent flag or whether it was created via the session path); only skip email if it genuinely

already fired. Don't double-send on true retries, but don't silently skip a never-sent receipt.

#3 (CORRECTED — NARROWED) — paid_at IS already written on every status:"paid" path; the audit's

"paid_at never written" is WRONG, do not touch those. The REAL gap: the deposit branch

(payments-webhook-shared.server.ts ~line 281–287) flips status to "accepted" but does NOT write

a deposit_paid_at timestamp. FIX: write deposit_paid_at: new Date().toISOString() on that

deposit-accepted update. Nothing else in this finding.

#8 — EMAIL MODE FOOTGUN. invoice-email.server.ts:79 infers mode as

opts.mode ?? (quote.status === "paid" ? "receipt" : "invoice"). A caller omitting mode on a

DEPOSIT payment would wrongly email a full invoice. FIX: make the fallback deposit-aware, or

require mode explicitly for deposit/balance and throw a clear error if it's missing on those,

so a missed mode can never send the wrong customer email.

#9 — INVOICE DUE DATE. invoice-email.server.ts:136 falls back to (send time + 14 days) when

quote.invoice_due_date is null, so a late-sent invoice shows a contractually wrong due date.

FIX: base the fallback on the quote's created/issued date + 14 days, not [Date.now](http://Date.now)(); only use

now() if no quote date exists.

#10 — AUDIO SIZE CAP. transcribe.functions.ts:9 caps base64 by CHARACTER length, rejecting

legitimate audio (~7.5MB real audio) with a cryptic Zod error. FIX: compute the real decoded

byte size (base64 length * 3/4 minus padding) and cap on bytes, with a clear user-facing error

if genuinely too large.

#11 — GREEDY JSON REGEX. ai-capture-quote.functions.ts:238 uses text.match(/\{[\s\S]*\}/),

which greedily spans from the first { to the LAST }, swallowing trailing prose/extra blocks

into the parse. FIX: extract the JSON robustly — non-greedy/brace-balanced matching, or prefer a

fenced ```json block if present — so trailing model prose can't corrupt the parsed object.

#4 — ACCEPT RACE (minor, real). portal.functions.ts already guards with

if (!["pending","sent"].includes(quote.status)) throw — so the common double-tap is caught; only

the tiny simultaneous-read window remains. FIX (light): make the status-transition UPDATE

conditional on current status in the same statement (e.g. .in("status",["pending","sent"]) on

the update, check affected rows) so two simultaneous reads can't both commit. Don't over-engineer.

=== VERIFY ONLY — do NOT rewrite working code, just confirm and report ===

#1 — Duplicate quote refs: allocateQuoteRef does MAX+1 with no lock, BUT user-data.ts (~line

1189–1209) already retries on 23505 and there's meant to be a unique index on ref. CONFIRM: (a)

the unique index/constraint on quotes.ref actually exists in the DB, and (b) the retry loop

retries enough times under contention. Only change anything if the index is missing or the retry

is absent — otherwise report "already mitigated".

#7 — Platform/Connect double-processing: webhook.ts checkout.session.completed is already gated

by an isSubscription check (mode subscription/setup or metadata.kind === "quottr_subscription"),

so it only acts on subscription sessions, not customer payment sessions. CONFIRM this gate fully

prevents the platform handler from touching Connect customer-payment sessions. Only harden if

there's a real gap; otherwise report "already gated".

=== RULES ===

- Minimal, surgical changes — this is money/auth code right before a native wrap.

- Every change must pass the existing money-correctness regression suite / badge matrix; extend

  tests to cover the new guards (especially #5 portal_visible on token path, and #2 no-skip /

  no-double email).

- Do NOT touch the paid_at paths (they're correct). Do NOT rebuild the quote-ref retry (#1) or

  the subscription gate (#7) unless VERIFY finds them actually broken.

- Report back per item: changed (what) vs verified-only (already-mitigated).

- Out of scope: all Tier 2 and Tier 3 findings — those are a post-wrap sprint.