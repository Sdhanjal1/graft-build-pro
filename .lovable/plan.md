File: `src/routes/quotes.$quoteId.tsx`

### Goal
Reduce visual density on first load of the quote detail page. The trader sees their quote content + one clear primary action. All secondary settings, status info, and extra actions move behind a collapsed "Options" accordion.

### 1. Imports
- Add `ChevronDown` to the existing lucide-react import.
- Import `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` from `@/components/ui/accordion`.

### 2. State
- Remove `moreOpen` / `setMoreOpen` state — the More bottom sheet is replaced by inline content.
- Add `optionsOpen` state to track Accordion open/closed if needed for chevron rotation.

### 3. Move elements out of the main flow into Options
- **Payment terms callout** (currently a prominent green box between line items and footer) → moves into the Options accordion.
- **Portal link expiry warning** (currently a prominent amber alert near the top) → moves into the Options accordion.
- **Material list CTA** (currently a second button in the sticky bar when `status === "accepted"`) → moves into the Options accordion.
- **Paid status banner** (currently shown in the sticky bar when `status === "paid"`) → moves into the Options accordion.

### 4. Sticky bottom bar — single primary action only
- Remove the `⋯` "More" button.
- Remove the materials CTA button.
- Remove the paid status div.
- Keep only the primary action button, made full-width (`w-full`) with comfortable height (`py-3.5`).

### 5. Add "Options" accordion
Insert a new section after the quote footer and before the `h-44` spacer.

Use `<Accordion type="single" collapsible>` with a single item labelled **"Options"**.
Inside the expanded content, render in order:

1. **Payment terms** — the green callout with the current terms label and "Change" button (still opens the existing `timingOpen` bottom sheet).
2. **Portal status** — if the link is expired or expiring soon, show the amber warning + "Regenerate and resend" button.
3. **Material list** — if `showMaterialsCta`, a button that opens the existing `materialsOpen` sheet.
4. **Paid status** — if `status === "paid"`, show how the customer paid.
5. **Action shortcuts** — an inline list replacing the old More bottom sheet. Render as a vertical list of buttons with the same conditional logic as the old More menu:
   - View as customer
   - Download PDF
   - Duplicate quote
   - Mark as paid (if not paid)
   - Send chaser on WhatsApp (if applicable)
   - Email customer
   - Call customer
   - Mark as sent (if pending)
   - Request payment (if accepted)
   - Take payment on site (if accepted or sent)
   - View final invoice (if invoiced)
   - Mark as declined (if not declined/paid)
   - Delete quote

Use the existing `MoreItem` component styling (or a similar inline row component) for the action list.

### 6. Remove More bottom sheet
Delete the JSX block for the `moreOpen` bottom sheet and its backdrop.

### 7. Keep all existing bottom sheets untouched
- `timingOpen` (payment timing selection)
- `askingPaid` (how did customer pay)
- `requesting` (Stripe payment request)
- `askDeposit` (deposit on acceptance)
- `askInvoice` (send final invoice)
- `sendOpen` (SendQuoteDialog)
- `assignOpen` (AssignClientDialog)
- `materialsOpen` (MaterialListSheet)

No backend changes, no changes to status logic, payment logic, or sending logic. This is a purely presentational reorganisation.