# Quote / invoice / portal — sixth pass

Scoped to `src/routes/quotes.$quoteId.tsx`, `src/routes/invoices.$quoteId.tsx`, `src/routes/portal.$token.tsx` (and the near-identical `portal.c.$code.tsx`). Visual hierarchy, density, and a handful of small UX bugs — no payment, status, or data-shape changes.

## Quote detail (`quotes.$quoteId.tsx`)

1. **Money summary card vs Itemised footer duplicate the same totals.** Today the page opens with a "Subtotal / VAT / Total / Deposit / Balance" card, then ~6 sections later the Itemised editor renders its own totals block. Keep the top card as the at-a-glance hero; collapse the editor's footer to just a `Total {formatGBP}` row aligned right. Deposit/balance only render in the hero.
2. **Hero card density.** Drop `p-4 space-y-3` to `p-5` with `divide-y divide-border/60` between subtotal/total/deposit blocks — removes the manual `pt-3 border-t` repetition and matches the divided-list pattern adopted in Settings.
3. **Status communication.** Status currently lives only in `PageHeader.right` as a `StatusBadge`. On a long page the badge scrolls out of view, leaving no signal in the sticky bar. Move a compact status pill into the hero card top-right (replacing the page header badge — `PageHeader` keeps title + ref only). When `paid`, swap the "Total" row colour to `text-status-paid` and prepend a `Check`.
4. **"Just sent" banner.** Currently `bg-lime/15 border-lime/40`. Promote to a flush row at the top of the hero card (above Subtotal) so it shares chrome instead of stacking. Auto-dismiss logic stays.
5. **Client card.** Already a `card-surface` link. Add `ChevronRight` on the right so it reads as navigable, and tighten avatar from `h-11 w-11` to `h-10 w-10`.
6. **Quote intro card.** Currently `p-5` italic muted text — visually heavy for a one-line greeting. Drop the card chrome entirely: render as an italic `text-sm text-muted-foreground` paragraph with `px-6 mt-4`. Saves ~80px of vertical.
7. **Job description + Itemised.** Merge into a single `card-surface` with `divide-y`: top sub-block "Job description", second sub-block "Itemised" (current editor). Removes the visual gap between two related cards.
8. **Payment terms button.** The lime double-border block reads as a callout, which is right — but the "tap to change" eyebrow is redundant with the trailing `ChevronDown`. Drop "· tap to change", keep the chevron.
9. **Materials CTA.** Today renders below payment terms only when `status === "accepted"`. Add an `Add materials` ghost row inside the Itemised sub-block (above the "Add line" CTA) for pre-acceptance quotes so the user discovers the feature earlier. Existing standalone CTA stays for accepted state where the count + open verb matters.
10. **Footer signature block.** Currently `px-1` inside a `px-5` section — the `-1` leaks past the card boundary. Use `px-5` directly and drop the inner `px-1`. Also wrap the signature paragraph in a single line: `Signed {cursive name} · {business_name}` reads cleanly; the leading `Signed` muted label is unnecessary, switch to em-dash prefix (`— {name}`) matching the Settings preview from pass 5.
11. **"More actions" accordion.** The four `<ul>` blocks separated by `border-t border-border/40` work but the `space-y-0.5` inside each makes the dividers feel inconsistent. Replace with a single `<ul className="divide-y divide-border/40">` and group via small uppercase headers (`<li className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground">`) for `Share`, `Payments`, `Status`, `Danger`.
12. **`MoreItem` row.** Add a trailing `ChevronRight` (muted) on rows that open a sheet/dialog (`Mark as paid`, `Request payment`, `Record deposit received…`, `Delete quote`); keep plain rows (`Email customer`, `Call customer`, `Download PDF`) without — communicates "this opens a step" vs "this fires now".
13. **Sticky bottom bar gradient.** `bg-gradient-to-t from-paper via-paper to-paper/0` works on light bg but the gradient sits *above* the button, fading into the page. Move the gradient into a separate `h-6 -mb-2` strip above the button row so the button has a solid background.
14. **Sticky bar safe-area.** Currently `bottom-20` (account for `BottomNav`) + `paddingBottom: env(safe-area-inset-bottom)`. On notched devices the bar floats too high. Switch to `bottom: calc(5rem + env(safe-area-inset-bottom))` and drop the inner padding to avoid double-counting.
15. **Chase secondary button.** `bg-ink/5 ring-1 ring-ink/10` reads as disabled next to the lime primary. Use `bg-card border border-border` for clearer affordance, keep `MessageCircle` icon.
16. **Confirm Delete dialog button.** Uses `bg-destructive text-destructive-foreground`; match the Settings dialog by switching to `text-paper` for token consistency.
17. **Bottom sheets — modal scrim.** Three custom `fixed inset-0 z-50 flex items-end bg-ink/60` sheets (`timingOpen`, `askingPaid`, `requesting`, `askDeposit`, `askInvoice`) duplicate Radix's `Sheet`. Out of scope to refactor, but add `max-w-md mx-auto` to the *outer* wrapper of `askingPaid` and `requesting` for consistency (currently only some sheets have it — fixes wide-viewport centering).
18. **`LineItemsEditor` input height.** `inputClass` uses `h-11` but `text-base`. On mobile the inputs read slightly small. Bump description input to `h-12` with `text-[15px]`. Qty/price keep `h-11`.
19. **`LineItemsEditor` "Add line" CTA.** Currently a styled button (assumed from existing pattern below the editor). Promote to a flush row with a lime `+` icon at the top of the items list so it's visible without scrolling past long jobs.

## Invoice detail (`invoices.$quoteId.tsx`)

20. **Ink banner padding.** `px-6 pt-6 pb-5` then a second `px-6 pb-5` block — vertical rhythm is off; the hero amount feels cramped below the ref. Switch to `divide-y divide-paper/10` and `py-6` per block.
21. **Ref typography.** `text-5xl` for `{ref}` competes with the `text-6xl` amount due below. Drop ref to `text-3xl`, keep amount at `text-6xl` — amount is the answer, ref is the label.
22. **`QuottrLogo` placement.** Sits top-right of the ink banner at `opacity-60`. Move to a flush footer row of the banner (`px-6 py-3 border-t border-paper/10 text-[10px] uppercase tracking-widest text-paper/40`) reading "Issued via Quottr". Cleaner hierarchy: brand identity in header, infrastructure attribution in footer.
23. **Billed-to + For + line items.** Three stacked cards with `mt-4 / mt-3`. Merge into a single divided card matching quote detail #7: sub-blocks `Billed to`, `For`, `Itemised`, `Totals`, `Payment terms`. Removes ~32px of inter-card gap.
24. **Totals — "Less deposit paid" position.** Currently sits *below* the Total row, which makes the math read awkwardly (Total then a subtraction then Balance). Reorder: Subtotal → VAT → Total → Less deposit paid → Balance due. The `Total` row drops its `border-t pt-2` (kept only for Balance due to anchor the eye).
25. **Send actions.** Three pills + a "Mark as paid" outline — four full-width buttons in a row is visually heavy. Group the share trio (WhatsApp / Email / PDF) into a flush divided card with icons left, label centre, chevron right; keep "Mark as paid" as the single lime CTA below. Mirrors the action-queue pattern from Home.
26. **"Mark as paid" button.** Currently `bg-card border-2 border-lime` — reads as secondary. On the invoice page, marking paid is the *primary* state-changing action. Promote to `bg-lime text-ink` and place at the bottom (single primary).
27. **`isPaid` state.** When paid, the four buttons collapse to a "Paid" pill — keep this. Add a `Download PDF` ghost button below the pill so users can still grab a receipt copy.

## Portal page (`portal.$token.tsx` + `portal.c.$code.tsx`)

28. **Header brand block.** `px-5 pt-6 pb-5 flex items-center gap-3` with logo + business name + quote ref. The ref ("Quote QT-12") is low-contrast at `text-[10px] text-paper/60`. Bump to `text-xs text-paper/80` — customers need to identify the document, not read fine print.
29. **Payment-received card.** Already strong (`text-2xl`, `text-3xl` amount, confetti-adjacent). Add a small `Download invoice PDF` link even before `isPaid` confirms (currently gated on `isPaid`). When the polling spinner is up, users see no action — show the button as `disabled` during `confirming` with "Preparing your invoice…".
30. **Job description card.** Same as quote detail #6: drop the card chrome, render as flowing prose under the title. Customer-side reads as a quote letter; a card around description feels app-y.
31. **Itemised card → divided.** Same treatment as invoice #23: sub-blocks `Itemised`, `Totals`, `Payment terms`. Currently the "Payment terms" lime block sits inside `card-surface` with its own border — two borders, one row. Drop the inner `border-2 border-lime`, keep the lime tint background and a thicker top divider.
32. **"How to pay" section header.** `text-[10px] uppercase tracking-widest text-muted-foreground font-semibold` — fine. The right-side "Preview" pill on pre-accept currently reads as the same weight as the section title, no distinction. Wrap "Preview" in a `bg-secondary px-2 py-0.5 rounded-full` chip so it reads as metadata.
33. **Pay by card button label.** Three states: `Accept & pay deposit £X`, `Accept & pay £X`, `Pay deposit £X`. Long strings truncate on small screens. Drop the amount into a second line below the button: button reads `Accept & pay deposit`, sub-line `£X today · £Y on completion`. Two-line button (`min-h-14`, `flex-col`).
34. **Bank transfer card.** `<dl>` with `divide-y` looks correct. Reference row uses `bg-lime/10` to draw attention to it — strong choice. But the amount row at the bottom reads as just another row. Swap to `bg-ink text-paper` for the amount row so the "what to pay" is unmistakable.
35. **Copy details button.** `border border-border` ghost — for a primary action on the bank card, promote to `bg-ink text-paper`. Customers' #1 action here is copying, not paying via a separate tab.
36. **Bottom action bar — Decline button.** Currently `flex-1` ghost next to `flex-[2]` lime accept. The decline button reads too prominent for a destructive secondary. Switch to `w-24` fixed-width with just the `X` icon + "No" label, freeing the accept button to take the full remainder and show its long label without truncation.
37. **`window.confirm` on decline.** `if (response === "declined" && !confirm("Decline this quote?")) return;` — native confirm on a customer-facing page is ugly. Replace with the project's `AlertDialog` (already imported pattern elsewhere). Aligns with the Settings pass 5 anti-`window.confirm` direction.
38. **`alert()` on errors.** Three `alert(…)` calls in handlers (`onPay`, `onRespond`, `handleDownloadInvoice`) — customer sees a native browser alert. Replace with `toast.error(…)` (sonner is already imported).
39. **Footer.** `Powered by Quottr` at `text-[10px]` — fine. Move below the bottom bar safe area (currently can be hidden behind the sticky bar). Add `mb-28` when `showBottomBar`.
40. **`portal.c.$code.tsx` parity.** Apply the same #28–#39 changes to the code-based portal page. The two should remain visually identical.

## Out of scope

- Payment, status transition, webhook, or RLS logic
- `BusinessLogo`, `WalletBadges`, `QuottrLogo` internals
- PDF generation (`downloadPortalPdf`, `downloadOrShareQuotePdf`)
- `SendQuoteDialog`, `MaterialListSheet`, `AssignClientDialog` internals
- `useScrollVisible`, `useServerFn` plumbing
- The deferred `Field` unification flagged in Settings pass 5

## Next pass after this

- `clients.$clientId.tsx` + `clients.index.tsx` (the last in-app surfaces)
- `messages.tsx` (chase thread + composer)
- `quotes.index.tsx` (list / filters / empty states)
