# Break Up the Beige with Ink Bands

Keep the warm paper palette. Make beige feel deliberate by introducing one anchored dark-ink band per main screen so the eye has a clear contrast moment instead of one continuous cream wash.

## Where the ink bands go

Each band is a full-width-of-shell `bg-ink text-paper` section sitting inside the existing `AppShell`. No layout restructuring — only a wrapper swap on one existing section per screen.

1. **`/app` (home)** — already has a dark hero header at the top. Tighten its rounded-bottom (`rounded-b-[1.75rem]`) and slightly increase its vertical padding so it reads as a deliberate "control deck" band. No new band added — fix the one that exists.

2. **`/quotes` (index)** — wrap the **totals/summary strip** (the "outstanding / overdue / paid this month" numbers that currently sit on cream) in an ink band with lime amounts. Status legend + filter chips stay on cream below. This gives the screen one strong horizontal break under the header.

3. **`/quotes/$quoteId` (detail)** — wrap the **totals block** (subtotal / VAT / total) in an ink band with the grand total in lime. The line items stay on cream cards above. Money becomes the visual climax of the page.

4. **`/invoices/$quoteId`** — same treatment as the quote detail totals: ink band around the total + status + "mark paid" pill, line items on cream above.

5. **`/clients/$clientId`** — wrap the **client header strip** (name, avatar, lifetime value) in an ink band so each customer record opens with a strong identity moment, then activity cards on cream below.

6. **`/settings`** — wrap the **profile / business identity** card at the top (logo, business name, trade) in an ink band. The settings list rows stay on cream.

7. **Portal/invoice public pages (`/portal/$token`, `/portal/c/$code`, `/invoices/$quoteId` public view)** — wrap the **amount-due hero** in an ink band with the figure in lime, "Pay now" pill in lime. Job details cream below.

## Visual rules for every ink band

- Background: `bg-ink` (warm near-black we already ship).
- Top + bottom edges: flush to the shell's horizontal padding, no inset gap, so the band reads as a real architectural element — not a floating card.
- Internal padding: `py-6 px-5` (matches existing gutter).
- Corner treatment: rounded only on the **outer** corners that meet the shell edge — `rounded-b-[1.75rem]` if it sits directly under the header, `rounded-[1.5rem]` if it floats mid-page with margin above/below. Never sharp corners.
- Money inside the band uses `text-lime` at `t-amount-lg` / `t-amount-xl` — the lime-on-ink contrast is the screen's payoff.
- Labels/eyebrows inside use `text-paper/70` `t-eyebrow`.
- One ink band per screen. Never two — if a screen wants two, the second becomes a cream card with an ink border instead.

## Spacing rhythm around bands

- 20px gap between the band and whatever sits above/below it (using existing `--stack-md`).
- Cards immediately under the band gain an additional `mt-1` "shadow lift" — uses the existing `card-surface` shadow, no new shadow token.

## Out of scope

- No palette/token changes in `src/styles.css` (ink + paper + lime stay exactly as they are).
- No marketing routes (`/`, `/pricing`, etc.) — they already alternate ink/cream sections.
- No copy edits, no new components, no logic changes.
- Bottom nav, status legend, typography tokens — untouched.

## Technical notes

- All edits are className changes inside the listed route files, wrapping one existing `<section>` per screen in `bg-ink text-paper` with the corner rules above.
- The ink band is allowed to extend edge-to-edge inside the `max-w-md md:max-w-lg lg:max-w-xl` shell — we'll use a `-mx-[var(--gutter-x)]` + `px-[var(--gutter-x)]` pattern so the band's color reaches the shell edge while content keeps the gutter.
- Verify visually with Playwright at 360 / 414 / 1280 after edits.

## Files touched

`src/routes/app.tsx`, `src/routes/quotes.index.tsx`, `src/routes/quotes.$quoteId.tsx`, `src/routes/invoices.$quoteId.tsx`, `src/routes/clients.$clientId.tsx`, `src/routes/settings.tsx`, `src/routes/portal.$token.tsx`, `src/routes/portal.c.$code.tsx`.
