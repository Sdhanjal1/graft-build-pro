## Problem

On the customer portal pre-accept screen, two identical CTAs render:

1. **In-card** "Accept & pay £80.00" inside the "Pay by card" panel (`portal.$token.tsx` lines 507–519).
2. **Sticky bottom bar** "Accept and pay £80.00" (lines 651–667).

Both call `onRespond("accepted")` with the same amount. On a short quote they sit on screen together — duplicative and confusing.

## Fix

Keep the **sticky bottom bar** as the single accept CTA pre-accept (it's always thumb-reachable and pairs with the "No" decline button). Suppress the in-card pay button while `isPreAccept` is true, but keep the "Pay by card" panel visible as a *preview* so the customer sees that card payment is supported.

### Changes (`src/routes/portal.$token.tsx`, ~lines 501–526)

Inside the `canPayNow` block:

- When `isPreAccept`: render the panel header, Stripe line, and `WalletBadges` only — no button. Add a small muted line: "Available after you accept." (keeps the "PREVIEW" chip honest).
- When not `isPreAccept` (i.e. already accepted, deposit/balance owing): render the button as today — this is the real "Pay now / Pay deposit" action and it's no longer duplicated by the bottom bar (which switches to status/balance states post-accept).

No changes to the sticky bottom bar, payment logic, amounts, or any other route.

## Out of scope

- Bank transfer card (no duplication there).
- Post-accept layouts (already non-duplicated).
- Any logic in `user-data.ts` or payment functions.