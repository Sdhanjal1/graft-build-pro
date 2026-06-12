# Clients audit — list, detail, new

Second pass of the per-screen tidy. Scoped to `src/routes/clients.index.tsx`, `src/routes/clients.$clientId.tsx`, and `src/routes/clients.new.tsx`. Visual hierarchy, density, consistency, and affordance only — no data or business-logic changes. Patterns carry over from the Quotes pass (chip filters, single rounded search, AlertDialog over native confirm, ink-on-cream tokens, etc).

## Clients list (`clients.index.tsx`)

1. **Header parity with Quotes.** Tighten the header eyebrow + title to the same rhythm Quotes now uses (eyebrow size, leading, spacing under the title). The "New" pill is fine — keep it, just align baseline with the title.
2. **Search field chrome.** Same fix as Quotes list — drop the full `card-surface` block, switch to a single rounded input with inline `Search` icon. Reads lighter and matches the rest of the app.
3. **Customer card hierarchy.** The avatar + name + address line is right, but the meta row currently mixes phone and quote count at the same `[11px] text-muted-foreground` weight, so neither stands out. Promote the **quote count + total** to a right-aligned secondary block (small, tabular `num`, ink) and drop the phone from the meta line — it's already on the detail page, and tapping the card to call is a worse pattern than tapping the row to open the customer. Keeps the address as the only sub-line.
4. **Duplicate badge.** The amber "Possible duplicate" pill is useful but is currently a noisy inline chip jammed next to the name. Move it to a small left-edge ribbon dot or a single-line muted hint under the address ("Looks similar to *Other Name* — review"), so the card stays scannable. Keep the detection logic.
5. **Empty state copy.** "Customers you quote for will show here" is fine but unhelpful — add a primary CTA inside the empty state ("Add your first customer" → `/clients/new`) so the only path forward isn't the small "New" pill in the header.

## Client detail (`clients.$clientId.tsx`)

6. **Top stats tiles.** "Total quoted" and "Paid" are two equal-weight tiles, but they answer different questions. Reshape to one combined card: big number = **Paid** (the outcome), with "of £X quoted across N {jobs}" as the secondary line. One glance, one story. Smaller, more informative, frees vertical space for the history below.
7. **Service summary + reminder card.** The "X jobs completed" card and the "Recommended every N months" reminder card are stacked separately with identical chrome — they're the same conversation (service cadence). Merge into a single card with two stacked lines: completed/last-service line on top, recommended-cadence line below, separated by a hairline. Halves the vertical real estate.
8. **Contact block — inline edit affordance.** `EditableRow` looks identical to the read-only `Row` until you focus it (only the bottom border appears on focus). Add a small pencil glyph on hover/focus and a faint dashed underline at rest, so it's discoverable that name/phone/email are editable without a tap-to-discover. Keep auto-save behaviour.
9. **Address + Property — make actionable.** `Row` already supports `href` but neither address nor phone uses it. Wire the address to a `geo:` / `maps:` link and the (now non-editable) read-only phone display to `tel:` so taps from the detail card actually do something on mobile. (Phone stays editable — long-press / second tap or a discrete inline pencil to switch into edit mode.)
10. **Customer portal placement.** "Customer portal" sits between the contact block and the job history — it's the most ignorable section but currently visually equal to history. Demote to **below** job history, or collapse into a one-line summary with a "Manage portal access" expand. Job history is the thing pros open this page for.
11. **Job history row hierarchy.** Same fix as Quotes list cards — the £ amount is currently the biggest thing on every row but it's the *secondary* fact for an existing customer (status + title is what they want). Drop amount to a tabular right-aligned `num text-sm` ink, promote the title to primary. Status/ref/cert chips stay on the meta row.
12. **"Quote again" button.** The lime pill in the section header is correct, but consider adding a softer secondary state ("New quote for {firstName}") so the action reads as continuing the relationship rather than starting over. Cheap copy win.

## New customer (`clients.new.tsx`)

13. **`Field` component — kill the card chrome per field.** Six stacked `card-surface` blocks for six fields is heavy and doesn't match `clients.new` density elsewhere in the app. Switch to a single `card-surface` containing all fields, with hairline dividers between rows. Label stays on top, field below. Phone/email stay side-by-side. Saves ~30% vertical scroll on mobile.
14. **Property type — chips not select.** `<select>` for 8 options is fine but feels like a desktop form. Replace with a horizontally-scrollable chip row (Homeowner / Landlord / Commercial / Letting agent) and a "More…" sheet for the sub-types (Victorian terrace, semi-detached, etc). Faster on mobile, no native picker UI.
15. **Save bar.** The full-width lime "Save customer" button at the end of the form is correct, but on a long form it's off-screen. Add a sticky bottom save bar (matches the pattern from `quotes.new`) so it's always reachable. Keep the inline button as well, or drop it in favour of the sticky bar.
16. **Error display.** `text-red-500` inline error above the button is the only red on the page and doesn't match the rest of the app (which uses `text-destructive` / toast surfaces). Swap to `text-destructive` and lean on the existing `sonner` toast for redundancy (already there).
17. **Phone/email validation.** No client-side validation — typos in phone/email silently save and break later (the quote-send flow needs them). Add lightweight format checks on blur (UK mobile shape + standard email regex) with an inline hint, non-blocking.

## Out of scope (this pass)

- `CustomerPortalPanel` internals (separate audit — it's substantial)
- `AssignClientDialog` — owned by the quote-send flow
- Duplicate-detection logic itself (only its presentation)
- Any data / RLS / server-fn changes

After this lands, next pass is **New quote flow** (`quotes.new`) or **Home / dashboard + nav** — your call.
