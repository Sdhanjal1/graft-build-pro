# Visual Polish — Bolder & More Confident

The home screen reads well because it has clear hierarchy, generous spacing and one hero moment (the big lime number). The rest of the app reads "busy" because every card competes — same weight, same radius, same chip styling, low contrast on the cream background. This plan brings the home-screen confidence to every other screen, then mirrors it on the portal and marketing.

No functional changes. CSS tokens + component-level styling only.

---

## 1. Tighten the design system (foundation — affects everything)

`**src/styles.css**`

- **Surface stack.** Today everything sits on cream paper with hairline borders. Introduce three explicit surfaces so cards stop blending into the page:
  - `--paper` (page bg) — slightly cooler, marginally darker so white cards lift
  - `--card` — pure cream, what most cards sit on
  - `--card-elev` — for the focal card on each screen (one per view)
- **Stronger ink.** Bump primary text to near-black for crisper headings; add `--ink-soft` for body so the contrast hierarchy is obvious at a glance.
- **Lime, used with intent.** Keep `--lime` as the hero accent, add `--lime-soft` (15% tint) for chips/highlights so we stop using grey for "good news". Promote `bg-lime` to mean "money / positive action" only.
- **Status colour clean-up.** Status chips currently mix lime/grey/red at the same weight. Re-tune to three tiers: positive (lime), awaiting (warm sand, not grey), urgent (red). Updated tokens flow through `STATUS_CHIP` / `STATUS_DOT` automatically.
- **Radii.** Tighten card radius from `1rem` to `0.875rem`, pills stay full. Modern, less template-y.
- **Shadow.** Single elevation token `--shadow-card` (soft, warm, ~8% opacity) used by `.card-focal` only. Replaces the heavier existing shadow.
- **Type scale.** Add `.display-xl` / `.display-lg` / `.display-md` Bebas helpers so big numbers and section titles share a rhythm across screens.

## 2. Screen-level rhythm (where "not easy on the eye" lives)

Same pattern applied to **Quotes list, Chaser, Clients, Settings, New Quote**:

1. **One focal block per screen** using `card-focal` (e.g. the totals strip on Quotes, the overdue summary on Chaser, the profile card on Settings). Everything else uses flat `card-surface` — kills visual competition.
2. **Section headers** become small uppercase Bebas labels with a thin lime underline rule, instead of the current bold sans headings. Gives the editorial confidence the home screen has.
3. **Row density.** Lists currently use `py-4` with hairline borders that wash out. Switch to `py-3.5` rows on a true card with internal dividers (`divide-y divide-ink/5`) — feels structured instead of floating.
4. **Numbers lead.** Money/counters move to Bebas display weight on the right of each row (mirrors home screen). The label is the secondary element.
5. **Sticky header polish.** `PageHeader` already condenses on scroll; tighten the un-condensed state — slightly smaller title (1.75rem), add a subtle 1px lime hairline along the bottom curve when scrolled, drop the blurred paper blob (reads noisy on small screens).

## 3. New Quote / Voice screen (the flattest screen today)

- Replace the current flat form stack with a single elevated quote-preview card on top + flat input rows below — same "one focal" rule.
- Voice FAB: keep the lime pulse, but seat it on a slim ink pedestal so it reads as the primary action even when content scrolls behind it.
- Live transcript tiles get a left lime bar + warmer paper background so they look generated, not pasted in.

## 4. Empty & loading states

- `EmptyState` icon circle: switch the celebrate tint from `bg-lime/30` to a soft lime gradient with a thin ring; default tint goes from flat grey to `card-elev`. Small change, big "considered" feel.
- Skeletons get the same warm tone as cards (currently cool grey — looks foreign on cream).

## 5. Bottom nav

- Active item: lime dot under the icon + ink label (instead of full lime pill) — quieter, more confident, matches the editorial direction.
- Pedestal: slight blur + warm tint behind the pill so it floats over content without the current hard edge.

## 6. Portal & request pages (cohesion pass)

- Lift the same surface stack, type scale, and "one focal card" rule.
- Customer-facing money number uses the home-screen display treatment so accepting a quote feels like the payoff moment.

## 7. Marketing site (Home / Features / Pricing / Trades)

- Already strong — apply only: matching radii, matching status colours in any embedded UI mocks, and the new Bebas section-label treatment so the marketing → app transition feels seamless.

---

## Technical notes

- All changes go through `src/styles.css` tokens + the components listed; no route logic touched.
- `STATUS_CHIP` / `STATUS_DOT` in `src/lib/status-styles.ts` get re-tuned values — single source of truth, propagates everywhere.
- `AppShell` `PageHeader` gets the header tweaks; the `condensed` behaviour stays.
- No new fonts (Bebas + DM Sans stay). No new dependencies.
- Dark portal/auth surfaces unchanged.

## Out of scope

- No copy changes, no information-architecture changes, no new screens.
- No animation overhaul beyond the existing tokens (the home screen's motion already works).
- Voice flow logic untouched — visual only.

## Files expected to change

- `src/styles.css` (tokens, utilities)
- `src/lib/status-styles.ts` (re-tuned chips/dots)
- `src/components/AppShell.tsx` (header polish)
- `src/components/BottomNav.tsx` (active state)
- `src/components/EmptyState.tsx`, `src/components/Skeletons.tsx`
- `src/routes/quotes.index.tsx`, `chaser.tsx`, `clients.index.tsx`, `settings.tsx`, `quotes.new.tsx` (apply focal/flat pattern, section labels, row rhythm)
- `src/routes/portal.$token.tsx`, `request.$proId.tsx` (cohesion pass)

Marketing pages (`index.tsx`, `features.tsx`, `pricing.tsx`, `trades.tsx`) only inherit token changes — no structural edits.

Can you instead show me some mock up design alternatives rather than change anything on the app itself 