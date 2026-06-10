
# Add voice-to-edit and payment options to the draft quote preview

## The gap

After voicing a quote on `/quotes/new`, the draft preview lets you tweak line items, assign a customer, and Save / Save & send — but it's missing two things that already exist on `/quotes/$quoteId`:

1. **Voice to edit the draft.** Once the AI has produced line items, there's no way to say "add a 4th hour of labour" or "swap the boiler for a Worcester 30i" by voice. You have to type-edit each cell.
2. **Payment options.** Timing (On completion / Deposit then balance / Upfront) and deposit amount are only configurable after the quote is saved and you're on the detail page. Draft quotes inherit a derived default silently — the trader can't set it during the same flow as creation, and there's no visible parity between a draft on `/quotes/new` and a draft viewed from the list.

The user wants both surfaced consistently on the draft preview, with buttons placed so they sit naturally inside the existing step flow.

## The fix

### 1. Voice to edit (on draft preview)

Add a single **"Edit by voice"** pill at the top of the editable preview card (next to the "Preview · editable" label), styled like the existing lime voice CTAs. Tapping it:

- Calls `handleVoiceStart()` with a new `recordTargetRef.current = "edit"` mode.
- Opens the same full-screen voice overlay used today (`?voice=1` UI), but the on-stop pipeline runs an **edit prompt** against the current draft (existing `generateAIQuote` server fn accepts a context — we'll pass the current `draft.line_items` so the AI merges/edits rather than starts fresh).
- On success, replaces `draft.line_items` with the merged result and keeps the same `draft.title` unless the user explicitly renamed it.
- On failure, surfaces the existing `voiceError` banner above the preview.

No new server fn for v1 — reuse `generateAIQuote` and pass the existing items as context in the description (e.g. prepend "Current quote: …\nChange requested: <transcript>"). If results are noisy we revisit with a dedicated edit endpoint, but that's out of scope here.

### 2. Payment options (on draft preview AND on saved drafts)

Add a new **Step 5: Payment** section to `/quotes/new` that appears as soon as `draft` exists (between the totals block and "Who's this for?", so the flow reads: preview → payment → customer → save). It contains the same three-option chooser already on the detail page:

- On completion
- Deposit then balance (with deposit £ / % inputs, mirroring `quotes.$quoteId.tsx` lines ~889–920)
- Upfront

State (`timing`, `depositAmt`, `depositPct`) is held locally on `/quotes/new`, seeded from `deriveTimingFromTotal(total)` + `defaultDepositPercent(userProfile.default_deposit_percent)`. On save (`save("draft")` or `save("send")`), these values are passed to `saveGeneratedQuote` / `updateGeneratedQuote` instead of those functions silently re-deriving timing — both functions get a new optional `payment_timing`, `deposit_amount`, `deposit_percent` triple in their input.

For **existing drafts opened via `?edit=`**, the same section pre-fills from the loaded quote's stored `payment_timing` / `deposit_*` (already on the row), so a draft viewed on `/quotes/new?edit=...` shows identical controls to the detail page.

### 3. Button placement (final order on draft state)

```text
[ Editable preview card        ]   ← "Edit by voice" pill added top-right
[ Step 5 · Payment             ]   ← NEW (timing + deposit)
[ Step 6 · Who's this for?     ]   ← renumbered from Step 4
[ Save as draft ] [ Save & send ]  ← unchanged
```

The floating "Generate quote" CTA is hidden once `draft` exists (already the case), so there's no competing primary button.

## Files touched

- `src/routes/quotes.new.tsx`
  - Add `timing`, `depositAmt`, `depositPct`, `depositAmtRaw`, `depositPctRaw` state and seed effect (run when `draft` first becomes non-null, and when loading an `editId` quote).
  - Render new "Edit by voice" pill inside the `{draft && ...}` preview card header.
  - Render new "Step 5 · Payment" block between the preview totals and the customer block; renumber the customer step.
  - Extend `handleVoiceStart` / `runTranscribe` to handle `recordTargetRef.current === "edit"` — feed current draft into `generateAIQuote` and replace `line_items` on return.
  - Pass payment fields into the save call.
- `src/lib/user-data.ts`
  - Add optional `payment_timing`, `deposit_amount`, `deposit_percent` to `saveGeneratedQuote` and `updateGeneratedQuote` inputs; use caller-provided values when present, fall back to current derivation otherwise.
- No changes to `/quotes/$quoteId.tsx` (already correct) or the voice overlay component.

## Out of scope

- Redesigning the voice overlay.
- New server function for "edit by voice" (reuse `generateAIQuote` with context).
- Customer portal / Stripe Connect changes — payment **timing** is a trader-side configuration; taking actual payments is unchanged.
- Touching the floating mic FAB on other pages.

## Acceptance

- After voicing a quote, the preview card shows an "Edit by voice" pill that opens the full-screen voice overlay and updates the draft's line items on stop.
- A "Payment" step is visible on every draft preview (newly voiced OR loaded via `?edit=`), with the same three-option chooser and deposit inputs as `/quotes/$quoteId`.
- Selected timing/deposit values persist to the saved quote and show identically on the detail page after save.
- Step numbering and button order on `/quotes/new` reads: preview → payment → customer → save / save & send, with no duplicate primary CTAs.
