# Post-onboarding first-run tooltip

## 1. Redirect onboarding to home

`src/routes/onboarding.tsx` — change `finish()`:

- Replace `navigate({ to: "/quotes/new", search: { voice: 1 } as never })` with `navigate({ to: "/app", search: { firstRun: 1 } as never })`.

## 2. Accept `firstRun` on /app

`src/routes/app.tsx`:

- Add `validateSearch` on the route to parse `firstRun` (coerce `1`/`"1"` → boolean).
- In `AppHomePage`, read it via `Route.useSearch()`.
- Compute `showFirstRun = firstRun && localStorage.getItem("firstRunSeen") !== "true"` (guarded for SSR with a `useEffect` + state).

## 3. First-run tooltip card

Render conditionally just above the mic hero section (so it visually points down at it):

- Card styled with existing tokens (paper/ink, rounded-2xl, subtle shadow, small downward caret on bottom edge using a rotated square).
- Copy: `Welcome, {firstName}. Tap the mic to speak your first quote.` plus a quieter line: `Try: "Boiler service for Mrs Jones, £85, ready Friday"`.
- Footer row: small `Got it` button (lime/ink) + `X` icon button (top-right).
- Both actions: `localStorage.setItem("firstRunSeen", "true")`, hide tooltip, and `navigate({ to: "/app", search: {}, replace: true })` to drop the query param.

## 4. Scroll-anchor the mic card

- Add `id="home-mic-card"` (and `ref`) to the mic `<section>`.
- In a `useEffect` that runs when `showFirstRun` becomes true, call `ref.current?.scrollIntoView({ behavior: "smooth", block: "center" })`.

## Notes

- No backend changes; pure frontend.
- Dismissal is permanent per device via `localStorage.firstRunSeen`.
- Stripe-connect banner logic untouched.

Something to add - Make the example copy in the tooltip trade-specific based 

on [userProfile.trade](http://userProfile.trade)_type:

- Plumber/Heating Engineer: "Boiler service for Mrs Jones, 

  £85, ready Friday"

- Electrician: "Replace consumer unit at 12 Oak Road, 

  £450, two hours"

- Gas Engineer: "Annual boiler service, Worcester 30i, £95"

- Builder: "Garden wall, 3 metres, brick and mortar, £600"

- Carpenter: "Fit two internal doors, £180 plus materials"

- Decorator: "Paint front bedroom, two coats, £220"

- Roofer: "Repair flashing around chimney, £180"

- Other / default: "Boiler service for Mrs Jones, £85, 

  ready Friday"

This makes the first-run experience feel built for them 

personally.