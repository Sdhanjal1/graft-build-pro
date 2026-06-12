# Settings audit — fifth pass

Scoped to `src/routes/settings.tsx` and the two embedded sub-components it owns (`BillingSection`, `AccountingSetup`). `PushPermissionCard`, `BusinessLogo`, `ExportInvoicesButton`, `AccountingExportButton` are out of scope unless trivially adjacent.

Visual hierarchy, density, consistency and a few small UX bugs — no data, save, or subscription-logic changes.

## Page-level

1. **Section component → use `divide-y` framing.** Each `<Section>` currently sits in its own `px-5 mt-5` block. With 7 sections the page reads as floating cards on paper rather than a structured list. Replace with a single `divide-y divide-border` container wrapping all sections, each section becoming a flush row (header pad `py-4`, content `pb-5`). Matches the treatment used on `clients.new`. Removes the 20px gaps between collapsed rows so the user can scan summaries quickly.
2. **Section header weight.** `text-xl` on every collapsed row competes with the actual content when one is open. Drop to `text-base font-bold` for collapsed, keep `text-xl` only for the *open* section. Visual signal of "this is what you're editing".
3. **Sticky header — Save indicator placement.** `SaveIndicator` lives in `PageHeader.right` with `text-paper/80`. When nothing is saving, the slot still reserves width — header reads as if there's an unlabelled control. Render the indicator only when `isSaving || isSaved || error` (it likely already does internally; if not, wrap conditionally). Also move the indicator to a floating chip just under the header (`sticky top-[header] mx-5 mt-2 inline-flex …`) so it doesn't fight the title.
4. **Sticky header background.** Currently `bg-paper`. Add `border-b border-border/60` so it doesn't bleed into the first open section when scrolled.
5. **Section summary truncation.** `gettingPaidSummary` ("HSBC ••1234 · 30% deposit · VAT") is fine, but `pricingSummary` shows "£0/hr · £0/day" before the user has set rates — reads as a finished state. Replace with "Set your hourly + day rates" when both are 0.
6. **Default-open behaviour.** Only "Your business" defaults open. On a returning user with a fully filled profile this still pushes the actionable bits (Getting paid, Notifications) below the fold. Add an `important` flag to Section and default-open any section whose `summary` indicates *missing* data: pricing if both rates are 0, getting paid if no `bank.account_number`. Single source: an `incomplete` prop that overrides `defaultOpen` when true.
7. **Section icons.** Each row gets a tiny leading icon (`Briefcase`, `PoundSterling`, `Landmark`, `FileText`, `Bell`, `CreditCard`, `AlertOctagon` for danger) at `h-4 w-4` left of the title. Helps scanning and matches the iconography in the action queue on Home.

## Your business

8. **Logo placement.** The logo block sits below 7 fields and only after the user has scrolled. Promote to the top of the section, above the fields, so brand identity reads first. Reduce the empty-state card from `py-6` to `py-5` and remove the dashed border in favour of a solid `border border-border` on `bg-card` — dashed lime on ink feels like a debug placeholder.
9. **Address grouping.** "Address line 1", "Address line 2", "Town / City", "Postcode" should sit in a labelled sub-group (`<fieldset>` styled as a flush card with a tiny eyebrow "Address"). Visual chunking that mirrors how the user reads it (one address, not four fields).
10. **`EditField` `<label>` spacing.** `mt-1.5` between label and input is fine; the `space-y-3.5` between rows feels loose at 3 fields and tight at 7. Switch the inner card to `divide-y divide-border/40` with each field as `py-3` — removes the need to tune `space-y`.

## Your pricing

11. **Card density.** Two money fields + one help line is over-sized in a `p-5` card. Drop to `p-4`, the help line moves to `text-[11px] text-muted-foreground -mt-1`.
12. **Hourly/day relationship hint.** Users frequently set one but not both. Add tiny calculated text under the grid: "Day rate ≈ 8h × hourly" if hourly set but not day, and "Hourly ≈ day / 8" the other way. Pure UI, no auto-fill.

## Getting paid

13. **Three sub-cards → divided list.** Bank details / Terms & deposit / VAT & registration are three `card-surface p-5` cards stacked with `space-y-3`. Replace with a single `card-surface divide-y divide-border` containing three sub-blocks. Each sub-block keeps its eyebrow heading but loses the surrounding card chrome. Cuts visual weight by ~40%.
14. **Sort code mask.** `inputMode="numeric"` but no formatting. Add a tiny on-blur formatter that inserts dashes (`12-34-56`). Visually consistent with how UK sort codes are written.
15. **VAT toggle position.** Toggle is mid-card; if VAT is on, the VAT number field appears below. Fine. But the registration label changes per trade — surface a `text-[11px]` hint under the field clarifying what to enter ("Required for Gas Safe-listed work" etc.) only when relevant.
16. **`BillingSection show="connect"` placement.** Connect sits at the bottom of Getting paid, which is correct contextually, but the embedded card has its own `card-surface p-5` chrome inside a Section that's already chrome-heavy. When #13 lands, wrap Connect as a fourth flush sub-block inside the same divided list.

## How quotes look

17. **Two textareas → unified card.** Same divide-y treatment. Intro / Footer / Signature name / Show signature read as a sequence, not four unrelated fields.
18. **Signature toggle should show a preview.** When `show_signature` is on, render a 1-line preview under the toggle: `— {signature_name}` in handwriting-ish italic (`font-serif italic text-muted-foreground`). Cheap; closes the loop on "what does this look like on the quote".
19. **Textarea heights.** Both at `rows={3}`. The intro is typically 1 sentence, footer is 2-3. Drop intro to `rows={2}`, keep footer at `rows={3}`.

## Notifications

20. **Toggle list.** Already uses `divide-y` — leave the structure but verify it nests cleanly inside the new outer `divide-y` (no double border).
21. **Push permission card vs toggles.** Two separate `card-surface` blocks with `space-y-3`. Combine — push card becomes the first row of the same divided list with an "Enable push" CTA on the right.

## Account & billing

22. **Sign out as a flush row.** Currently its own `card-surface` with a single button. Drop the chrome — sign out becomes a flush divided row under AccountingSetup.
23. **`AccountingSetup` — collapsible codes already exist.** Good. Tighten the codes summary row: replace the `bg-secondary/60` pill with a flush divided sub-row matching #13. The collapsible details/summary at the bottom ("Need a simple paid-quotes summary instead? ›") should use the same chevron+expand pattern as Section, not the native `<details>` (whose chevron and focus ring don't match the design).
24. **`BillingSection show="subscription"` styling.** Same shape as Connect — when #13 + #16 land, audit that subscription card lives nicely as a flush row inside this Section.

## Danger zone

25. **Tone.** Section title `text-status-overdue` is loud; collapsed it reads like an active warning. Soften to `text-status-overdue/80` collapsed, full saturation when open. Also add a `bg-status-overdue/5` tint to the open content area to underline "you're in a destructive section".
26. **Delete button.** The button inside the card uses `text-status-overdue` on `bg-card` — currently the only destructive-tone button in the app that isn't on a coloured background. When open, swap to `bg-status-overdue/10` on the row with a right-aligned `ChevronRight` to communicate "this opens a confirmation step".

## Delete account dialog

27. **`Cancel` / `Delete account` buttons.** `<button>` with custom classes — fine, but the delete button uses `bg-status-overdue text-white`. Use `text-paper` to match the rest of the app's tokens. No visual change; consistency.
28. **Type-DELETE input.** `autoFocus` on a destructive confirmation is a footgun — users tab past the description and start typing without reading. Remove `autoFocus`; require an explicit tap.

## Sub-components in this file

29. **`Section`** — accept `incomplete?: boolean` + `icon?: LucideIcon` (per #6, #7). Apply to all call sites.
30. **`EditField` / `Input` / `MoneyField`** — three near-identical field components. Out of scope for this pass (refactor would touch every call site), but flag in `.lovable/plan.md` for a later cleanup pass: unify into a single `<Field>` with `type="text|money|select|toggle"` variants.

## Out of scope

- `BillingSection.tsx` internals (already audited in pass 4 for the Stripe Connect banner placement)
- `PushPermissionCard`, `BusinessLogo`, `ExportInvoicesButton`, `AccountingExportButton`
- Autosave plumbing (`useAutoSave`, `SaveIndicator`)
- Profile schema, RLS, server functions
- Trade-aware registration label heuristics

Next pass after this: **Quote detail (`quotes.$quoteId.tsx`) + invoice detail (`invoices.$quoteId.tsx`) + portal pages**.
