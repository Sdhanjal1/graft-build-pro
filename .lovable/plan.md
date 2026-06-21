# Palette Review & Recommendations

## What's working

The Quottr palette is already a strong, ownable system — not a generic SaaS look.

- **Ink (#1a1a18) + Paper (warm cream)** — high-contrast, editorial. Makes amounts and CTAs feel important without shouting.
- **Lime (#c8e04a)** as the only accent — instantly recognisable, scarcity gives it power. Used for "money", "primary CTA", "paid", "active nav".
- **Status spectrum** — amber/blue/green/red is conventional in trade tools, so customers and tradespeople read it without learning it.
- **Warm neutral chroma (~80°)** keeps borders, secondary surfaces, and cards in the same family — nothing reads cold or sterile.

## Where it strains

These are real, fixable issues — not redesign-it-all problems.

1. **Lime is overloaded.** It marks: primary CTA, money hero, "paid" status, active tab, micro accents, ad headlines. When everything is the loudest colour, nothing is. Eyes can't find the one thing to tap.
2. **Two greens compete.** `--status-paid: var(--lime)` (yellow-green) and `--status-green` (deeper paid-green for dots) live on the same screens, and amber/lime sit next to each other on the chaser tiles — small misreads at a glance.
3. **Booked vs Pending vs Amber** are three orange-ish tokens close in hue. Pills can blur into each other in a busy quote list.
4. `**--surface` is declared but barely used.** Dark panels are mostly `bg-ink`, so the intended "lifted dark" tier doesn't read. Dark sections (voice capture, footer, banners) feel flat.
5. **Borders + muted background are nearly the same value** (`0.86` vs `0.92`). Card edges disappear on the cream background unless we lean on the brutal-shadow utility.
6. **No reserved "danger" tone separate from overdue** — destructive UI and "you missed a deadline" share `--status-overdue`, so a delete confirm looks the same as a financial warning.

## Recommended changes (no redesign, just tightening)

### A. Promote a second accent: `**--ink-accent**` (deep teal or aubergine)

Used for: secondary CTAs, "selected" states, dark icon chips currently using lime. Frees lime to mean *only* "money + primary action". Suggested: `oklch(0.42 0.08 195)` (slate teal) — sits behind lime visually, never competes.

### B. Use `--surface` properly

Define a 3-tier dark scale (`--ink`, `--surface`, `--surface-2`) for nested dark panels (recorder, marketing hero, footer columns) so they read as layered, not flat.

### C. Split the status family into 2 clear groups

- **Payment status** (lime=paid, amber=pending, red=overdue) — keep.
- **Workflow status** (blue=waiting customer, teal=booked, ink=draft) — re-tone so they don't bleed into the payment palette. Move `--status-booked` from orange to a warm teal; this also breaks the orange-overload.

### D. Pull `--status-paid` off `var(--lime)`

Give "paid" its own slightly deeper green (`oklch(0.72 0.18 140)`) so paid pills don't read as "another CTA". Keeps lime sacred for actions.

### E. Stronger borders on cream

Bump `--border` from `0.86` to `0.82` chroma `0.015`. Cards lift without needing a shadow.

### F. Reserved `--danger`

Introduce `--danger` for destructive UI (delete confirms, irreversible actions), distinct from `--status-overdue`. Same red family, slightly more saturated, used only on `<button>` not status pills.

### G. Optional warm tint on `--paper`

Push warmth a touch (`oklch(0.95 0.018 78)`) — closer to receipt paper, further from generic off-white. Subtle but reinforces the brand voice.

## What I'd leave alone

- Ink + paper relationship — core to the brand.
- Lime hex — perfect for the tradesperson audience.
- Tailwind token wiring through `@theme inline` — no churn there.

## Suggested next step

Pick which of A–G you want me to ship — I'd recommend **A, C, D, E** as the highest-impact bundle (clearer hierarchy, less colour overload, no visual redesign). Reply with the letters and I'll implement, take before/after screenshots of Inbox, Quote detail, and Chaser, and confirm contrast across the changed tokens.  - DO A-G 