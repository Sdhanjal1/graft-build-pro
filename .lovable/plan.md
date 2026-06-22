## Goal
Show the chosen payment method (Card / Bank transfer / Cash) on the trader's quote detail screen so it's obvious which option the customer will see, without re-opening the Send dialog.

## Where
`src/routes/quotes.$quoteId.tsx` only. The state already exists (`method` / `setMethod` at lines 97 and 301), persistence and customer-portal rendering already work — this is purely a missing surface on the trader view.

## What to add
A compact "How you'll be paid" row inside the existing summary card (just under the Total / deposit block around line 880, before the receipt/email status section). It shows:

- Icon + label for the active method (CreditCard "Card", Landmark "Bank transfer", Banknote "Cash")
- A one-line sub:
  - card + `connect.chargesEnabled` → "Customer pays via card link"
  - card + not ready → amber "Set up card payments in Settings" with chevron → /settings
  - bank + `userProfile.account_number` set → "Customer sees your bank details"
  - bank + no bank → amber "Add your bank details in Settings" → /settings
  - cash → "You'll mark this paid in person"
- A right-aligned "Change" affordance that opens the existing `SendQuoteDialog` (sets `sendOpen=true`) — reusing the chooser already built there, no new picker.

Hidden once `status === "paid"` (no longer actionable).

## Design tokens
Reuse `rounded-2xl`, `bg-secondary` / `bg-card`, `text-ink`, `text-muted-foreground`, amber via existing `AlertTriangle` pattern from `PayMethodOption`. Same icon set already imported in the file (`CreditCard`, `Landmark`, `Banknote`, `AlertTriangle`, `ChevronRight`).

## Out of scope
- No DB changes
- No edits to SendQuoteDialog, user-data.ts, or the customer portal
- No new component file — small inline block in the existing summary card

## Verify
- Typecheck clean
- Toggle method in Send dialog → row updates immediately (state is already wired via `setMethod`)
- Card-not-ready and bank-not-set states show the amber setup nudge linking to /settings
