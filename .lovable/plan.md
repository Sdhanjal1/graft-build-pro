## Home hero video — re-cut + presentational polish

Two parallel passes against the same video block on the landing page.

### Pass 1 — Re-cut the Remotion source for the landing hero

Current `quottr-how-it-works.mp4` is 23.3s and wastes its first ~4.8s on a brand intro before the value moment.
| Beat | Now (start) | After |
|---|---|---|
| BrandFlash "Quottr." | 0.0s | removed |
| Scene1Hero (brand title) | 0.6s | removed |
| Scene2Voice (the hook) | 4.8s | **0.0s** |
| Scene3Quote | 10.1s | 5.0s (tightened) |
| Scene4Send | 15.8s | 8.5s |
| Scene5End wordmark | 20.1s | removed |
| **Loop length** | **23.3s** | **~12.8s** |

Loop now cuts from "PAID" straight back to the mic — same beat returning visitors first saw.

**Files:**

1. **`remotion/src/MainVideo.tsx`** — landing variant
   - Remove the `<BrandFlash>` sequence and the `vignette` ramp.
   - Drop `Scene1Hero` and `Scene5End` from the `TransitionSeries`.
   - Tighten `Scene3Quote` from 170 → 110 frames.
   - Keep `Scene2Voice` (160) and `Scene4Send` (130) untouched — they already carry the hook and payoff.
   - Total: 160 + 18 + 110 + 18 + 130 = **436 frames** (~14.5s with fades; comfortably under the 15s sweet spot).

2. **`remotion/src/Root.tsx`** — register a second composition `main-landing` with `durationInFrames={436}` pointing at a thin wrapper (or refactor `MainVideo` to accept a `variant` prop: `"full" | "landing"`). Keep the existing `main` composition intact so the longer cut survives for social/other surfaces.

3. **`remotion/src/scenes/Scene2Voice.tsx`** — already shows the typewriter caption "Quote Mrs Jones for a new combi boiler…" so option B (silent captions) is already satisfied. No edit.

4. **Re-render** the landing cut and overwrite `public/quottr-how-it-works.mp4`:
   ```
   cd remotion && node scripts/render-remotion.mjs   # adjust script to target `main-landing` + outputLocation /dev-server/public/quottr-how-it-works.mp4
   ```

### Pass 2 — Presentational polish on `src/routes/index.tsx` (lines 58–70)

Purely the `<video>` block — no re-encode beyond pass 1.

1. **Poster image** — extract a still of frame 0 of the new cut (the mic moment) to `public/quottr-how-it-works-poster.jpg` via `bunx remotion still` during pass 1, then add `poster="/quottr-how-it-works-poster.jpg"`.
2. **`preload="metadata"` → `preload="auto"`** — this is the hero, prefetch it.
3. **Aspect-ratio container** — wrap the `<video>` in a `style={{ aspectRatio: "16 / 9" }}` div (the source is 1920×1080) so the card reserves space and CLS is zero before metadata loads.
4. **Reduced motion + pause-on-click**:
   - `useEffect` reads `window.matchMedia("(prefers-reduced-motion: reduce)").matches` → if true, don't autoplay; render with `controls` and show the poster.
   - Otherwise default to autoplay; clicking the video toggles play/pause via a `ref`. Add an accessible label and a small visually-hidden text cue ("Tap to pause").
   - This is the only logic addition — small `useRef` + `useState` for paused flag. Keep the existing visual frame (`rounded-[2rem] overflow-hidden border ring-lime/25 shadow-2xl`) untouched.

### Out of scope
- WebM/AV1 alternate sources (different request — call out separately if wanted).
- `VideoObject` JSON-LD (different request).
- Any redesign of the surrounding hero copy.

### Verification
- After render: confirm new mp4 ≤ ~2.5 MB, opens on a phone, loops cleanly.
- After code edit: load `/` in Playwright at desktop 1280×1800, screenshot the hero — confirm poster visible during load, no layout shift on metadata arrival, click-to-pause works, and reduced-motion media query disables autoplay.
