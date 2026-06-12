# Portal parity — `portal.c.$code.tsx`

Bring the code-based client portal (`src/routes/portal.c.$code.tsx`) into visual + UX parity with the token portal changes from the sixth pass. This route is a multi-quote list with expandable rows (not a single-quote layout), so a few items adapt rather than copy 1:1.

## In scope (file: `src/routes/portal.c.$code.tsx`)

1. **Header brand block (#28).** Bump the "Customer Portal" sub-line from `text-[10px] text-paper/60` to `text-xs text-paper/80`. Same density tweak the token portal got — the customer needs to read this, not squint.

2. **Payment received card (#29).** When `paymentResult === "paid"`:
   - While `confirming` is true, show a disabled "Preparing your invoice…" ghost button under the spinner line.
   - Once a paid quote is detected in the polled data, swap to an enabled `Download invoice PDF` button wired to `downloadPortalPdf(..., "invoice")` for the first `status === "paid"` quote.

3. **Job description as prose (#30).** Inside the expanded quote panel, drop the eyebrow + indented block; render `job_description` as a flowing `text-sm whitespace-pre-line` paragraph with `px-4 py-3`. No "Job description" label.

4. **Itemised → divided sub-blocks (#31).** Restructure the expanded panel as one continuous `divide-y divide-border` stack: `Job description` (prose) → `Itemised` (line items) → `Totals` (Total row) → `Payment terms`. Drop the inner `rounded-xl border-2 border-lime` on the payment-terms block; keep `bg-lime/10` tint as the sub-block background and rely on the parent divider for separation.

5. **Status pill chip treatment (#32 adaptation).** In each quote row header, the date eyebrow currently sits flush next to the status pill at the same visual weight. Wrap the date in `bg-secondary px-2 py-0.5 rounded-full text-[10px] text-muted-foreground` so the status pill stays the primary signal and the date reads as metadata.

6. **Accept button two-line label (#33).** The accept CTA truncates long strings like "Accept & pay deposit £1,200". Switch to a two-line button (`min-h-14 flex-col gap-0.5`): primary line "Accept & pay deposit" / "Accept & pay" / "Pay deposit", sub-line `£X today · £Y on completion` (or just `£X` when there's no split). Helper derives from existing `payment_timing`, `total`, `deposit_amount`.

7. **Decline button — fixed-width "No" (#36).** Replace the 2-col grid with a flex row: decline becomes `w-24 shrink-0` with just `X` icon + "No" label; accept takes `flex-1`. Frees the accept button to show its full label without truncation.

8. **Replace `confirm()` on decline (#37).** Swap the native `confirm("Decline this quote?")` for the project's `AlertDialog` (same pattern as `portal.$token.tsx`). Accept keeps its inline confirm (no native dialog) — only the destructive path gets a modal.

9. **Replace `alert()` on errors (#38).** `onRespond` currently calls `alert(e.message)`. Replace with `toast.error(...)` from `sonner` (already used elsewhere in the project; add import if missing).

10. **Footer clearance (#39 adaptation).** This page has no sticky bottom bar, but the per-quote inline accept/decline can sit near the page footer on short viewports. Bump footer `mb-4` → `mb-8` for breathing room. No safe-area math needed here.

## Skipped from token portal (don't apply)

- **#34, #35 (bank-transfer card / Copy details button)** — this page has no bank transfer / "How to pay" section. The code-based portal is a list view; payment flow stays per-quote via the existing accept button.
- **Sticky bottom action bar items** — not present on this route.

## Out of scope

- Polling, payment, status, webhook, or RLS logic.
- `BusinessLogo`, `downloadPortalPdf`, `respondQuoteFromPortal` internals.
- The `portal.$token.tsx` page (already done in the previous pass).
- Service-reminder card, documents section, "Request a new quote" CTA — untouched.

## Technical notes

- `AlertDialog` import: `@/components/ui/alert-dialog` (same set used in `portal.$token.tsx`). Add a single dialog instance with local `declineTargetId` state to avoid one-per-quote mounts.
- `toast`: `import { toast } from "sonner"`.
- Accept-button sub-line: reuse the same derivation logic already present in `portal.$token.tsx`; lift to a small local helper `function accentLabel(q)` returning `{ primary, sub }` for clarity.

## Next pass after this

- `clients.$clientId.tsx` + `clients.index.tsx`
- `messages.tsx`
- `quotes.index.tsx`
