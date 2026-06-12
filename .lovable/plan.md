# Spacing Audit — Suggestions

I walked the mobile app shell and key routes. Spacing is mostly consistent, but a few patterns add up to a "loose" feel — especially around headers, sticky CTAs, sheets, and form/list rows. Below are the highest-impact tightens, grouped so you can opt in/out per area.

## 1. AppShell `PageHeader` (touches every screen)

`px-5 pt-7 pb-6` + a `mt-4` divider + `mt-3` title row = ~44px of stacked vertical air above the screen body. On 550-wide preview the header eats too much above-the-fold.

Proposed:

- `pt-7 pb-6` → `pt-5 pb-4`
- divider `mt-4` → `mt-3`, title row `mt-3` → `mt-2`
- compact variant `pt-7 pb-6` → `pt-5 pb-4`
- `AppShell` outer `pb-28` → `pb-24` (bottom nav is 64px; 28 ≈ 112px leaves a visible gap on short pages)

Net: ~14–18px reclaimed at the top of every screen.

## 2. Sticky bottom action bars (quotes.new, clients.new, quotes.$quoteId, portal)

Pattern repeated ~6 places: outer wrapper `px-5 pb-5 pt-2` + button `py-4` + a 24px gradient fade above. Combined with AppShell's `pb-28`, the CTA sits very high off the bottom edge.

Proposed:

- wrapper `pb-5 pt-2` → `pb-3 pt-1.5`
- gradient fade `h-6 -mb-2` → `h-4 -mb-1`
- primary button `py-4` → `py-3.5` (still 52px hit area with text)

## 3. Bottom-sheet content (`p-5 pb-8`)

5 sheets in `quotes.$quoteId.tsx`, plus `SendQuoteDialog`, `MaterialListSheet` — all use `p-5 pb-8`. The `pb-8` is double-counting safe-area when the sheet is already above the nav.

Proposed: `p-5 pb-6` (and rely on `safe-bottom` for the inset). Saves ~8px per sheet.

## 4. Form fields (`clients.new`, `quotes.new`, `settings`)

`Field` component uses `p-3.5` with a `mt-2` between label and control. Label is `text-[10px]` uppercase — `mt-2` is generous for that scale.

Proposed:

- `p-3.5` → `p-3`
- label→control `mt-2` → `mt-1.5`
- hint `mt-1.5` → `mt-1`

## 5. List rows (quotes index, messages, clients)

Quote/message/client rows use `p-3.5` or `py-4 px-4`. With existing card border + 16px row gap, vertical rhythm feels airy.

Proposed:

- row padding `p-3.5` / `py-4` → `p-3` / `py-3`
- list `space-y-2` between rows stays; remove any `mt-4`/`mt-3` wrappers above lists in favor of a single `mt-3`

## 6. `quotes.index.tsx` hero pipeline + tiles

- Tiles grid currently `gap-2` with each tile `p-3.5` — fine. But the section wrapper has `mt-4` + the hero strip has its own `mb-3`/`mb-4`. Collapse to one `mt-3` between hero and tiles.
- "Active pipeline value" label row: tighten `mt-2` → `mt-1.5`.

## 7. `messages.tsx`

- Thread list wrapper `pb-24` is redundant with AppShell `pb-28` → drop it (just `pb-2`).
- Skeleton cards `p-3.5` → `p-3`.
- Gap between "Quote requests" section and "Messages" section currently `mt-6` → `mt-4`.

## 8. `settings.tsx`

- Section spacing `space-y-3` between cards is fine, but card internals use both `py-3` and `py-2` inconsistently. Standardise rows on `py-2.5 px-4`.
- `mt-1.5` repeated 9× under labels → fold into a `SettingsRow` helper with built-in spacing (also future-proofs).

## 9. Marketing pages (lower priority — not "the app")

`index.tsx`, `about.tsx`, `features.tsx`, `trades.*` use `py-20 md:py-28` for every section. That's intentional landing-page rhythm; **leave alone** unless you want a denser marketing site. Flagging for completeness.

## 10. One-offs worth a quick pass

- `onboarding.tsx` main `pt-8 pb-10` → `pt-6 pb-8`; CTA `mt-8` → `mt-6`.
- `auth.tsx` `py-10` + `mb-8` header → `py-8` + `mb-6`.
- `forgot-password.tsx` / `reset-password.tsx` `mb-10` header → `mb-6`.
- `quotes.new.tsx` line ~2386 `mt-8` on the mic stack → `mt-6`.
- `confirmed.tsx` `mb-10` + `mb-8` → `mb-6` / `mb-5`.

---

## Suggested rollout

Three tiers — pick what you want me to apply:

- **A. Global wins (highest ROI, low risk):** #1 PageHeader, #2 sticky CTAs, #3 sheet padding. Affects every screen, ~30px reclaimed above the fold + tighter bottom CTAs.
- **B. List/form density:** #4, #5, #7, #8. Makes lists scannable, reduces scroll on form-heavy screens.
- **C. Page-specific polish:** #6, #10. Cleans up the leftover loose-ends.

Tell me **A / B / C / all**, or any subset, and I'll implement.

Do A B and C