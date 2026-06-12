# Home / nav / banners audit — fourth pass

Scoped to `src/routes/app.tsx` (the signed-in home), `src/components/BottomNav.tsx`, `src/components/BannerSlot.tsx` + its four banner children, and `src/components/FloatingMicButton.tsx`. Marketing landing (`routes/index.tsx`) is out of scope — it has its own visual language and was audited before signup work. `PullToRefresh` is already tidy, no changes.

Visual hierarchy, density, and affordance only — no data, save, or subscription-logic changes.

## Home (`/app`)

The signed-in home tries to do four things at once (greeting + £ hero, stat pills, action queue, today's jobs, materials, Stripe banner, customer book, mic CTA). Order and weight need tightening.

1. **Hero £ — single source of truth.** Three different "hero number" branches (paid today / owed / won today) live in the ink header, each with the same Bebas Neue size. Means the user has to read the eyebrow to know which figure they're staring at. Restructure to a single `<HeroNumber>` block that takes `{ amount, label, accentColor, href }` so the eyebrow ("Paid today" / "You're owed" / "Won today") is always rendered in the same slot with the same type ramp, and the £ value drops to `clamp(3.5rem, 18vw, 6rem)` (currently 22vw clips at 550px). Removes 60 lines of near-duplicated JSX.
2. **Stat-pill ↔ action-card redundancy.** The header pills (`to send`, `booked`, `awaiting reply`, `overdue`) repeat the same four buckets shown immediately below as `ActionCard`s. Drop the pills entirely — the action cards already lead with count + £ and are tap targets. Frees ~50px above the fold and removes the "I tapped a pill but it scrolled past the same info" confusion. Keep the pills only when `hasActions === false` is impossible (it isn't — guarded by `hasActions &&`).
3. **Hero-card tone palette.** `ActionCard` hero variant picks `bg-ink text-paper` for overdue, pending, and neutral — three identical surfaces. Map tone → background distinctly: overdue = `bg-status-overdue text-paper`, pending = `bg-ink text-paper`, accepted = `bg-lime text-ink`, neutral = `bg-paper text-ink` with `ring-1 ring-border`. User can identify the queue's mood at a glance without reading the eyebrow.
4. **Section order rework.** Current order: header → materials → Stripe banner → customer book → action queue → today's jobs → mic. The mic CTA is the product's primary action and is buried below five sections. Reorder to: header → action queue → today's jobs → mic CTA → materials → customer book → Stripe banner. Mic moves up to "first scroll" position; passive utilities (materials, customer book, Stripe) drop below.
5. **Customer book row — visual weight.** It's currently a full-bleed `bg-ink/5` row outside any section padding (`px-4 py-3`), which makes it visually heavier than the cards above and below. Wrap in the same `px-5 mt-4` section frame as its siblings, change to `card-surface` with the existing icon-left + arrow-right layout. Consistency with materials card.
6. **Stripe-connect banner placement.** This banner is rendered inside the home feed only — but it's a billing setup, not a piece of work-in-progress. Move into `BannerSlot` (see banner section below) so it sits in the same priority chain as the trial / offline banners. Frees the home page from one-off banner dismissal state.
7. **First-run tooltip — anchor.** The "Welcome, {firstName}" lime tooltip sits inside the mic section with a downward-pointing caret, but with section reordering the mic moves up. Keep the caret pointing at the mic; verify scroll-into-view still lands near the centre after reorder. (Behaviour-only check, no logic change.)
8. **`StatPill` deletion.** Once #2 lands, the `StatPill` sub-component is unused — remove the function definition (lines ~442–472).
9. **Mic CTA — secondary "type instead".** The mic card has no fallback for users who can't / won't speak (loud site, accent issues). Add a small `text-paper/60` "Or type" link under the rotating prompts that navigates to `/quotes/new` without `?voice=1`. Matches the entry-state we just landed in `quotes.new`.
10. **Today's jobs row affordance.** Each row has `active:scale-[0.99]` but no `tabular-nums` on the time column. Add tabular-nums so 9:30 and 10:00 left-align cleanly. Also bump the time column from `w-14` to `w-16` so 10:00 doesn't crowd the title.

## Bottom nav (`BottomNav.tsx`)

11. **Active-tab label ellipsis risk.** When active, the pill expands to `gap-1.5 px-3 py-2` plus a label. With 5 items and a max-width of `28rem`, "Settings" + icon at 12px font fits, but "Chasers" + active "Inbox" together pushes the nav close to overflow on 320px iPhone SE. Add `min-w-0` on the label `<span>` and `truncate` so long active labels clip rather than wrap. (Defensive — no visible change at common widths.)
12. **Unread dot — accessibility.** The dot is `bg-lime` ring on the icon, but only on `/messages`. Bump from `h-2.5 w-2.5` to `h-2 w-2` with a stronger `ring-2 ring-ink` so it reads as a notification rather than part of the icon. Add a numeric `aria-label` ("Inbox, 3 unread requests") instead of the boolean "unread requests" — already partly there, just include the count.
13. **Hide-nav heuristic.** Currently hides on `/auth` and `/capture`. Extend to also hide on `/onboarding` (full-screen flow) and `/quotes/new` (where the sticky save bar collides with the nav). The save bar in `quotes.new` already added bottom padding to clear it, but visually a quote-edit screen with a tab bar reads "this isn't the focus" — hiding the nav signals "finish this first".

## Floating mic (`FloatingMicButton.tsx`)

14. **Component is dead code.** `FloatingMicButton` exports but is never imported (`__root.tsx` renders only `BottomNav`). Either delete the file outright, or wire it in. Recommendation: **delete**. The bottom nav already includes a quote shortcut via the home tab → mic card, and the home page leads with a giant mic. A second floating CTA would compete with the bottom nav. Removes 26 unused lines + a `feedback("tap")` registration.

## Banners (`BannerSlot.tsx` and children)

15. **Banner-slot priority documented but not surfaced.** Comment says "Priority: PWA install > Trial banner > Offline banner" but the code order is Update > PWA > Trial > Offline. Fix the comment; verify the order matches product intent (Update wins because it's a refresh, then install for fresh users, then trial for retention, then offline for transient). One-line change.
16. **Trial banner — copy + styling.** Hard-coded Tailwind palette (`bg-red-50`, `text-red-900`, `bg-amber-50`) bypasses the design tokens. Replace with `bg-destructive/5 text-destructive border-destructive/20` (expired) and `bg-status-pending/5 text-status-pending border-status-pending/20` (warn). Matches the rest of the app.
17. **Trial banner — single action.** Expired variant renders one button inside a flex `gap-2` container as if more buttons were planned. Simplify to a single right-aligned `<button>` outside the flex. Removes orphan flex container.
18. **Offline banner stacking.** Uses `z-[70]`, but the bottom nav uses `z-40` and the save bars use `z-50`. Offline pill is `fixed inset-x-0 top-0` so no collision — but document the layer order in a short `// z-index map` comment at the top of `BannerSlot` so future banners don't drift.
19. **UpdateBanner / PWAInstallBanner consistency pass.** Both should match the new trial banner shape (`mx-4 my-3 rounded-2xl border ...` with semantic tokens). Will check both files and align.
20. **`BannerSlot` mount location.** Currently rendered at the bottom of `__root.tsx`'s `RootComponent`, after `BottomNav`. That puts banner DOM beneath the nav — fine because banners are either `mx-4 my-3` (in-flow at top of body) or `fixed`. Verify visually that the trial banner shows above the action queue rather than below the nav.

## Out of scope (this pass)

- `routes/index.tsx` (marketing landing — separate visual system)
- `PullToRefresh` (already tidy)
- `Splash`, `AppShell` chrome (no complaints; not part of nav/banners)
- Subscription / billing logic, PWA install eligibility logic, SW registration
- `BannerSlot` priority *order* (only the comment is updated, not the logic)

Next pass after this: **Settings / billing / profile** — long screen with several stacked sub-sections that could use the same `divide-y` treatment we used on `clients.new`.
