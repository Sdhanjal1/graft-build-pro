## Fix overlapping scene transitions in the homepage hero video

The current "landing" cut uses `fade()` from `@remotion/transitions`, which cross-fades — outgoing and incoming scenes are layered on top of each other for ~0.6s, which is the overlap you're seeing.

Switch to a **fade-through-black** pattern so only one scene is visible at a time.

### Change (single file)

`remotion/src/MainVideo.tsx`, inside the `variant === "landing"` branch (lines ~55–79):

- Wrap each `TransitionSeries.Sequence` child (`Scene2Voice`, `Scene3Quote`, `Scene4Send`) in a small `<FadeInOut>` helper that fades the scene from 0→1 over the first 9 frames and 1→0 over the last 9 frames using `useCurrentFrame()` + `interpolate()`.
- Remove the two `TransitionSeries.Transition presentation={fade()} ...` entries between the sequences.
- Replace `<TransitionSeries>` with `<Series>` (back-to-back, no overlap). The dark `<Backdrop />` behind the series shows through during each fade, producing the through-black handoff.
- Keep durations: 160 / 130 / 130 frames = 420 frames total — matches the existing `main-landing` composition duration in `Root.tsx`, so no Root change needed.
- Leave the `variant === "full"` branch untouched (used elsewhere).

### Re-render

Re-render only the landing composition and overwrite the homepage asset:

```
cd remotion && node scripts/render-remotion.mjs main-landing public/quottr-how-it-works.mp4
```

(or the equivalent CLI: `bunx remotion render src/index.ts main-landing ../public/quottr-how-it-works.mp4`)

Then copy the rendered file into `public/` of the web app if the render script writes to `/mnt/documents/`. Regenerate the poster from frame ~36 only if the first visible frame changed; otherwise keep the existing poster.

### Verification

- Spot-check frames at the handoff points (around frames 160 and 290) with `bunx remotion still` to confirm one scene is fully gone before the next appears.
- Confirm new mp4 is still ≤ ~2.5 MB.
- Reload `/` and watch the hero loop — no double-exposure moment between scenes.

### Out of scope

- No copy or layout changes to `src/routes/index.tsx`.
- No changes to the `full` variant, vertical, or social compositions.
- No re-encoding of individual scenes.
