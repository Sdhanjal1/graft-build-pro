## Scope

Two presentation-only refactors. No data, routing, or behaviour changes.

- `src/components/BottomNav.tsx` — remove the 3D lift on the active item and the chunky lime drop-shadow.
- `src/components/AppShell.tsx` (`PageHeader`) — replace the dark ink slab used on every non-home screen with a calmer paper header. Home screen (`/app`) doesn't use `PageHeader`, so it's untouched.
- `ActionPill` (lives inside `PageHeader`) — drop the 3D `shadow-[0_3px_0_0_#9db23a]` + `translate-y-0.5` press for a flat lime pill.

## Bottom nav

Keep: the ink glass pill, item layout, active-shows-label, unread dot pulse, hide rules.

Change:
- Active item: solid lime pill, ink text. No `-translate-y-0.5`, no `shadow-[0_4px_0_0_#9db23a,...]`. Add a hairline `ring-1 ring-ink/10` only.
- Inactive item: same muted paper colour, but drop the bottom hover bar (the tiny lime line) — it adds noise.
- Outer pill: keep the dark glass background and `ring-1 ring-white/15`, but soften the outer shadow from `0_10px_28px_-10px` to `0_6px_18px_-10px` so the nav reads as resting on the surface, not floating like a button.

## PageHeader (every screen except `/app`)

New look — paper, not ink:

```text
┌─ paper background (no rounded bottom slab) ────────┐
│  ‹  QUOTES                                  + NEW  │   ← row 1
│     1 pending · 2 booked                            │   ← row 2 subtitle
└─────────────────────────────────────────────────────┘
hairline divider in ink/10
```

- Background: `bg-paper` (no `bg-ink`, no `rounded-b-[2rem]`, no left lime stripe).
- Title: Bebas, `text-ink`, `text-3xl` expanded / `text-xl` condensed.
- Subtitle: `text-[11px] uppercase tracking-[0.18em] text-muted-foreground`; urgent dot retained as a small `bg-status-overdue` dot.
- Back chevron: small circular `bg-secondary text-ink` button (no `bg-paper/10` on ink).
- Crumb trail: `text-muted-foreground` with ink/40 separators.
- Sticky + IntersectionObserver-driven condense behaviour kept exactly as-is; only the visual treatment changes. When condensed the divider becomes a stronger `border-b border-border` so the sticky bar reads as a clear shelf.
- Bottom edge: hairline `border-b border-border` instead of the ink slab's natural separation.

### ActionPill (used by Quotes "+ New", etc.)

- Flat lime pill: `h-9 px-4 rounded-full bg-lime text-ink font-bold text-[12px] uppercase tracking-tight active:scale-[0.97] transition`.
- Remove `shadow-[0_3px_0_0_#9db23a]` and `active:translate-y-0.5 active:shadow-none`.

## Out of scope

- The home screen ink hero (`/app`) — left alone, it's the one place the dark editorial slab is signature.
- The Quotes ink "Pipeline" focal card and the new brutalist Chaser focal card — those are page content, not chrome.
- The lime-pulse + status-overdue dot behaviour, sticky/condense logic, hide-on-keyboard logic.

## Verification

Open `/quotes`, `/clients`, `/messages`, `/chaser`, `/settings` and a deep route (`/quotes/$id`) at mobile width; confirm:
- Headers read as paper-on-paper, with title + optional subtitle, back affordance, and `+ New` where applicable.
- Active nav item is a flat lime pill with no vertical lift or chunky shadow.
- Home (`/app`) is unchanged.
