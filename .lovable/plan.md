# New quote flow audit — `quotes.new.tsx`

Third pass of the per-screen tidy. Scoped to `src/routes/quotes.new.tsx` (the page wrapper and its main render — the voice overlay internals stay out, see "Out of scope"). Visual hierarchy, step framing, and affordance only — no AI / save / line-item math / customer-data changes.

This is the most-used screen in the app, and it's accumulated two distinct shapes (pre-draft entry vs post-draft editor) that need a cleaner spine.

## Entry state (no draft yet)

1. **Voice is the headline, not a footnote.** Right now the only entry is a textarea card, with "Or speak it instead" as a small text link under it. Voice is the product's core feature. Restructure to two peer affordances at the top: a large **"Speak the job"** lime button (mic icon, primary), and **"Or type instead"** revealing the textarea below. Default the mic primary because that's what we want them to use. (Keeps the same `handleVoiceStart` / `textareaRef` plumbing.)
2. **`RotatingPrompts` placement.** The rotating prompt list appears only when `desc` is empty, under the textarea. Promote it to appear under the voice CTA too — same prompts, same component — so the suggestions are visible regardless of which entry mode is showing. Reinforces "here's what good input looks like".
3. **Trial-ended messaging.** The generate button overloads its own label with "Trial ended, add payment method" — long string inside a primary CTA, and there's no link to fix it. Pull this into a separate **inline banner** above the button: short copy + a "Update payment method" link to `/settings`. Button stays clean ("Generate quote" + disabled state).
4. **Generate-button error state.** The "Retry generate" icon-swap is good, but the error message currently renders below the button as a tiny pill (`text-status-overdue`). Promote to a proper inline error chip above the button with the exact failure (network / quota / parse) so the user knows whether to retry or rephrase.

## Draft state (post-generate)

5. **Step labels are broken.** Sections are labelled "Step 4" and "Step 5" — there is no Step 1/2/3. Either drop the numbering entirely (preferred — the flow is linear and self-evident) or renumber 1–3 (job → payment → customer). Going with **drop numbering**, replace with clear section headings: "Your quote", "Payment", "Customer".
6. **Customer assignment ordering.** Customer is currently Step 5 — last. But the save buttons are disabled until a customer is set, so users build the whole quote then hit a wall. Move **Customer** above **Payment** (so order is: quote preview → customer → payment). Customer is the gate; surface it earlier. Save buttons can then be primary and never disabled-without-explanation.
7. **Customer block — pattern reuse.** The "existing" and "new" customer cards reimplement field styling locally (`label` + `input` + `border-b`). Use the same `Field` shape we just introduced in `clients.new` so all three customer-entry surfaces (clients.new, quotes.new, assign dialog) look identical.
8. **Customer card "Change" link.** Same fix as Quotes detail / payment terms — the entire selected-customer card should be the tap target to re-open the picker. Drop the inline underlined "Change" text in favour of a chevron and an `active:scale-[0.99]` press state on the whole card.
9. **Save bar — primary/secondary hierarchy.** Two equal-weight buttons (`Save as draft` and `Save & send`) at the bottom of the form. `Save & send` is the primary action 95% of the time. Restructure to a sticky bottom save bar (matches `clients.new` pattern just landed): large lime **Save & send**, with a smaller `Save draft` link above or as a secondary ghost button to its left. Removes the `pb-64` form-padding hack.
10. **Disabled-CTA explanation.** When `clientName` is empty the save buttons are disabled with a `title` tooltip + a centered helper line. Tooltips don't fire on touch. Replace with an always-visible inline hint **inside the sticky bar** ("Add a customer above to save") that's only shown when disabled. Bonus: tapping it scrolls to the customer block (`scrollIntoView`).
11. **Error block on save.** The save-error block is good (specific copy + retry) but lives at the very bottom of the form below the save buttons, where it can be off-screen after a failed `save("send")`. Hoist into the sticky bar area (above the buttons) so the user sees it without scrolling.
12. **"Edit by voice" affordance.** The dark preview header has a small `bg-lime` "Edit by voice" pill in the top-right. Good action, weak discoverability — looks like a status badge. Add a subtle "Tap to edit, or use voice" line under the "Preview · editable" eyebrow so users understand both entry modes from the start.

## Line-item editor (within the preview card)

13. **Row wrap behaviour on narrow widths.** The qty / unit-toggle / £ / total row uses `flex-wrap` and the total drops to a new line on iPhone SE-class widths. Restructure to a 2-row layout on narrow: row 1 = description + trash, row 2 = qty + price + total (right-aligned). Stops the total from orphaning.
14. **Source pill noise.** Three source variants ("Your price" lime, "Your usual price" lime/15, "Quottr suggested" secondary) are visible on every line. Once a quote is mostly user-priced this becomes wallpaper. Show the pill **only when source is `voice` or `learned`** (the wins worth signalling) — drop the muted "Quottr suggested" badge entirely. Reduces visual chatter; suggested is the implicit default.
15. **Trash affordance.** Trash icon next to each description is at full opacity always — easy to fat-finger on mobile. Drop to `text-muted-foreground/40` at rest, full opacity on row focus/hover, and require a confirm (`AlertDialog`, not `window.confirm`) when deleting a row with a non-zero `unit_price`. Empty rows delete immediately.

## Payment section

16. **Deposit input pairing.** £ and % inputs are presented as two equal pill-cards. They're linked (changing one updates the other) but visually independent. Add a subtle "↔" between them and a one-line helper underneath ("£ and % stay in sync") so the relationship is obvious.

## Out of scope (this pass)

- `VoiceOverlay` / `MicLevelBars` / `MicLevelRings` — separate audit (substantial)
- `SendQuoteDialog`, `CustomerPicker` internals (audited with the send flow / clients respectively)
- AI generation logic, line-item math, save logic, RLS
- The big stuff in `useEffect`s — handlers / debouncing / scroll behaviour

Next pass after this: **Home / dashboard + nav** (`index.tsx`, `BottomNav`, `FloatingMicButton`, banners, pull-to-refresh).
