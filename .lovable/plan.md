## Polish the voice FAB

Two surgical edits, exactly as specified.

### 1. `src/components/FloatingMicButton.tsx` — replace contents

- Import `feedback` from `@/lib/feedback`.
- Add `onPointerDown={() => feedback("tap")}` for the 10ms haptic.
- Add `active:scale-[0.94]` + `transition-transform duration-150` for the press depression.
- Add an absolutely-positioned `<span class="fab-mic-pulse">` behind the icon/text for the resting lime ring pulse.
- Mark icon + label `relative` so they sit above the pulse layer.
- Keep all existing hide logic, route, search params, and aria-label intact.

### 2. `src/styles.css` — add pulse styles

Inside `@layer utilities`, add:

```css
.fab-mic { position: fixed; }
.fab-mic-pulse {
  animation: fab-mic-pulse 2.4s ease-out infinite;
  z-index: -1;
}
```

Outside the layer, add the keyframes and the reduced-motion guard:

```css
@keyframes fab-mic-pulse {
  0%   { transform: scale(1); opacity: 0.5; }
  70%  { transform: scale(1.45); opacity: 0; }
  100% { transform: scale(1.45); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .fab-mic-pulse { animation: none; opacity: 0; }
}
```

### Verification

After applying I'll confirm: gentle pulsing ring at rest, press depresses the button, haptic fires on pointerdown, and the pulse is suppressed under `prefers-reduced-motion`. Then I'll paste back both the component and the new CSS block.
