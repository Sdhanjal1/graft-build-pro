# Batch 1 — Payment & Data Integrity (plan for approval)

Good news on data state before we touch anything:

- **No duplicate `(user_id, ref)` rows in `quotes` today** — the partial unique index `quotes_user_ref_idx UNIQUE (user_id, ref) WHERE ref IS NOT NULL` already exists, so the DB has been silently protecting us. The race is still real (client-side `MAX` over `mockQuotes` can collide → insert would now fail with a 23505), but there's no backfill needed.
- `invoice_payments` already has `UNIQUE (stripe_session_id)` but **nothing** stops an insert when both `stripe_session_id` and `stripe_payment_intent` are NULL (the third branch at line 165) — that's the real dedupe hole.

## 1. Webhook full-payment status guard (`payments-webhook-shared.server.ts:194-204`)

Mirror the deposit branch's guard so a replayed `payment_intent.succeeded` can't drag a `completed` / `declined` / already-`paid` quote backwards, and can't resurrect a manually refunded one.

```ts
await supabaseAdmin
  .from("quotes")
  .update({ status: "paid" })
  .eq("id", quoteId)
  .eq("user_id", userId)
  .in("status", ["pending", "sent", "accepted", "overdue"]);
```

Rationale for the allowed set: full payment legitimately moves any of those forward to `paid`. `completed` stays `completed` (job done bookkeeping is downstream of payment status in this app — we don't want to overwrite it). `declined` and `paid` are terminal; no-op. This is a code-only change.

## 2. Quote-ref race — server-side generation + keep the unique index (`user-data.ts:1100`)

The current `nextQuoteRef()` walks the in-memory `mockQuotes` array. Two tabs / two voice captures racing both compute the same `QTR-007` and the second insert 23505s on `quotes_user_ref_idx`. Fix:

**a. New server fn `allocateQuoteRef**` in a new file `src/lib/quote-ref.functions.ts`:

- `.middleware([requireSupabaseAuth])`, no input.
- Inside handler: `SELECT ref FROM quotes WHERE user_id = $userId AND ref ~ '^QTR-[0-9]+$'`, parse max numeric suffix, return `QTR-${(max+1).toString().padStart(3,"0")}`.
- Retry loop: on the caller side, if `saveGeneratedQuote`'s insert fails with code `23505` on `quotes_user_ref_idx`, re-call `allocateQuoteRef` and retry once (covers the small TOCTOU window between SELECT and INSERT under true concurrency). Cap at 3 attempts then surface a friendly error.

**b. Replace client `nextQuoteRef()` call sites** with `await allocateQuoteRef()`. Audit shows it's used in `user-data.ts` `saveGeneratedQuote` and `quotes.new.tsx` draft flow — I'll grep and update each site.

**c. Existing duplicates handling**: confirmed zero duplicates in production data right now (`SELECT user_id, ref, COUNT(*) ... HAVING COUNT(*) > 1` returns 0 rows), and the partial unique index already exists. So **no backfill migration needed**. I'll leave the index as-is.

**d. Keep `nextQuoteRef()` as a deprecated client-side fallback** only for preview rendering (e.g. unsaved drafts showing a placeholder). Real persistence path goes through `allocateQuoteRef`.

No schema migration required for this step — purely a server fn + caller refactor.

## 3. Webhook dedupe for the no-id branch (`payments-webhook-shared.server.ts:165-178`)

The third insert branch fires when Stripe sends an event with no `cs_…` and no `pi_…` (rare but happens for some Connect / test relays). With no `stripe_session_id` and no `stripe_payment_intent`, the existing `UNIQUE (stripe_session_id)` is NULL-permissive and offers no protection — every retry inserts a fresh paid row → double credit, double email, double push.

Two-part fix:

**a. Code (defensive):** in the third branch, refuse to insert without at least one Stripe identifier. Log and return — Stripe will retry, and the retry usually carries the id. If it never does, we'd rather miss one paid row than double-credit.

```ts
} else {
  console.error("[payments/webhook] paid event with no session_id and no payment_intent — skipping insert", {
    type: evt.type, quoteId, userId,
  });
  await logErrorEvent({
    userId, context: "payments.webhook.no_stripe_id",
    message: `Paid event ${evt.type} had no stripe identifier`,
  });
  return;
}
```

**b. Migration (belt + braces):** add a partial unique index so even if a future code path slips, the DB rejects the duplicate:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS invoice_payments_pi_unique
  ON public.invoice_payments (stripe_payment_intent)
  WHERE stripe_payment_intent IS NOT NULL;
```

(The session-id unique is already there. PI-level unique closes the second branch's residual race where two retries arrive before the first commit lands. The third branch is now guarded by code.)

I'll surface this as a single migration through the migration tool.

---

## Files touched in Batch 1

- `src/lib/payments-webhook-shared.server.ts` — status guard + no-id branch refusal
- `src/lib/quote-ref.functions.ts` — **new** server fn
- `src/lib/user-data.ts` — replace `nextQuoteRef` usage, keep deprecated fallback, add retry on 23505
- `src/routes/quotes.new.tsx` — call new server fn where applicable
- **Migration:** partial unique index on `invoice_payments.stripe_payment_intent`

## What I'm NOT doing in Batch 1 (and why)

- Not adding a `UNIQUE (quote_id, request_type, status)` constraint as originally suggested. That would block legitimate cases like a customer paying a deposit, the deposit row going `paid`, and the same quote later getting a separate balance `paid` row — both legitimately `(quote, "deposit"|"balance", "paid")` and we want both to insert. Stripe-id-based dedupe is the correct primitive.
- No data backfill (none needed).
- No change to deposit-branch status flow (already guarded correctly).

Confirm and I'll apply Batch 1, then move straight into Batch 2 (security/reliability) and Batch 3 (hygiene) applied directly with a summary.

Approved — and good catch rejecting the status-based dedupe in favour of Stripe-ID dedupe; that's the correct primitive and avoids blocking legitimate deposit+balance rows. The "zero existing duplicates + index already exists" finding is reassuring. All three fixes are sound:

1. Status guard — the allowed-set (leaving `completed` alone, terminal no-ops) is right.
2. Server-side ref + retry-on-23505 — correct way to handle the residual race.
3. No-id refusal + PI-level unique index — right level of protection on the money path.  
Apply Batch 1, then proceed with Batch 2 and 3 directly and give me the summary.

One thing to confirm after Batch 1: test that a normal quote save still gets a clean sequential ref (no spurious retries firing), and that a real card payment still records correctly through the webhook (the status guard + no-id changes don't block a legitimate payment).