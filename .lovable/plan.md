# Re-issue quote on total change

When an edit changes a live quote's total, revert it to `sent` so the customer must re-accept. Block the edit if a paid deposit would exceed the new total.

## Data layer — `src/lib/user-data.ts`

Add a shared helper `maybeReissueOnTotalChange(q, newTotal)` used by every edit path that mutates totals.

Behaviour:
- No-op unless `q.status` is `"sent"` or `"accepted"` AND `Math.abs(newTotal - q.total) > 0.005`.
- Query paid deposit:
  ```ts
  const { data } = await supabase
    .from("invoice_payments")
    .select("amount_cents")
    .eq("quote_id", q.id)
    .eq("request_type", "deposit")
    .eq("status", "paid");
  const depositPaid = (data ?? []).reduce((s, r) => s + (r.amount_cents ?? 0), 0) / 100;
  ```
- If `depositPaid > 0 && newTotal < depositPaid - 0.005`, throw:
  `New total £X is below the £Y deposit already paid. Refund the difference in Stripe first, then edit.` (amounts via `formatGBP`). The caller must throw before persisting; integrate the check BEFORE the `supabase.from("quotes").update(...)` call so a blocked edit never reaches the DB.
- Otherwise: `await supabase.from("quotes").update({ status: "sent" }).eq("id", q.id)`, mutate `q.status = "sent"`, return `true` (signal to caller to tag `_reissued`).
- Deposit fields (`deposit_amount`, `deposit_percent`) are never written.

Integrate into `updateQuoteLineItems` (the only existing total-mutating editor — there is no `updateQuote` today; if a future full-edit function is added it must call the same helper):
1. Compute totals.
2. Call helper with new `total` — pre-check; if it throws, abort.
3. Run the existing `supabase.update({ line_items, subtotal, vat_amount, total })`. If the helper reissued, status was already flipped server-side in step 2 (separate update is fine; or merge into one update by including `status: "sent"` in the same patch when reissued — preferred to keep it atomic).
4. After mutating `q`, if reissued tag the returned object:
   ```ts
   Object.defineProperty(q, "_reissued", { value: true, enumerable: false, configurable: true, writable: true });
   ```
   `enumerable: false` keeps it out of `JSON.stringify` and any future `{ ...q }` writes.

Type: extend the `Quote` type (or a local interface) with optional `_reissued?: boolean` so TS allows consumers to read it.

## UI — `src/routes/quotes.$quoteId.tsx`

`LineItemsEditor` currently doesn't read `_reissued`. Wire it:

1. Add `onReissued?: (newStatus: QuoteStatus) => void` to its props.
2. In `persist()`, capture the returned quote: `const updated = await updateQuoteLineItems(...)`. If `updated?._reissued`, call `onReissued?.(updated.status)`. Errors thrown by the helper already surface through the existing `toast.error(e.message)` in the `catch`.
3. Parent (line ~962) passes:
   ```ts
   onReissued={(newStatus) => {
     setStatus(newStatus); // existing on-screen status state
     const firstName = client?.name?.split(" ")[0] ?? "your customer";
     toast("Quote updated — total changed", {
       description: `${firstName} needs to re-accept. Re-share the updated quote.`,
       duration: 10000,
       action: { label: "Re-share", onClick: () => setSendOpen(true) },
     });
   }}
   ```
   Use whatever local state currently mirrors `quote.status` on this screen; if status is read directly from `quote`, also bump the local quote snapshot / `bumpVersion` subscriber so the screen re-renders into the `sent` action set.

## Notes / out of scope

- No edge function, no migration. Pure client-side logic against existing `invoice_payments` rows (already populated by the Stripe webhook).
- Acceptance gating already uses `["pending","sent"]`, so flipping to `sent` automatically re-opens the accept path on the portal — no portal changes needed.
- Existing portal token stays valid; "Re-share" reuses `SendQuoteDialog` (`setSendOpen(true)`), matching the original send path. The invoice-email pipeline is not touched.
- Deposit recompute paths are untouched; balance is already derived live as `total − deposit`.

## Manual test checklist

1. Edit a `sent` quote up by £50 → status reverts to `sent`, toast with "Re-share" appears, tapping it opens `SendQuoteDialog`.
2. Edit an `accepted` quote with a £300 paid deposit down to £200 → edit blocked, toast shows the refund-first message, status unchanged, DB row unchanged.
3. Edit a `paid` or `completed` quote (total change) → no reissue, no toast (status filter excludes them).
4. After reissue, `deposit_amount` / `deposit_percent` in DB are unchanged; portal balance recalculates from new total.
