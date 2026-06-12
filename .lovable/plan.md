# Transcript audit guard + accessible listening cue

Two small additions on top of the just-shipped voice flow changes. Scope stays inside `src/routes/quotes.new.tsx` and its overlay component.

## 1. Audit guard — transcript captured, never rendered

Goal: make it structurally impossible to render the live transcript in the overlay, so a future edit can't accidentally bring it back. The Web Speech handlers still update `liveFinalRef` / `liveInterimRef` / `setLivePreview` (the AI still gets the full transcript on regenerate and on stop) — only the overlay's access to it goes away.

- Drop `livePreview` from the overlay component's props (both the JSX call site around line 1096 and the props type around line 1984).
- Drop `liveSupported` from the overlay props too if it's only used by the removed transcript block (verify; keep if referenced elsewhere).
- Add a short comment block above the listening cue and above `setLivePreview` in the recogniser handler explaining the invariant: "Transcript is captured internally to feed the AI on every regenerate / on stop. It must never be rendered in the overlay. If you need a live cue, use the audio-level bar below."
- Add a dev-only assertion inside the overlay component: on mount, if `import.meta.env.DEV` and the props object contains a key named `livePreview`, `console.error` a clear message. Cheap tripwire if someone re-plumbs it.

## 2. Accessible listening cue with audio-level bar

Replace the pulsing-dot cue with a small audio-level meter plus an `aria-live` announcement. Keep it scoped to the existing cue — no layout changes elsewhere.

### Audio-level capture

- In `startRecording`, after `getUserMedia` succeeds and before/after the MediaRecorder is created, set up a Web Audio `AnalyserNode` on the same `stream`:
  - Lazily create an `AudioContext` (reuse the existing `AC = window.AudioContext || webkitAudioContext` pattern already in the file).
  - `createMediaStreamSource(stream)` → `AnalyserNode` with `fftSize: 256`, `smoothingTimeConstant: 0.6`.
  - Store refs: `audioCtxRef`, `analyserRef`, `levelRafRef`.
  - Run a `requestAnimationFrame` loop that reads `getByteTimeDomainData`, computes RMS, normalises to 0–1, and writes to a new `level` state (throttled to ~30fps via rAF).
- In `mr.onstop` and any teardown path (`stopRecording`, session reset, error exits), cancel the rAF, disconnect the analyser, close the AudioContext, and reset `level` to 0. Guard `close()` calls — they reject if already closed.
- Skip the analyser setup entirely in clip/edit mode (matches the existing `isClipMode` branch — no live cue needed there).

### Cue UI (replaces the current dot + "Listening…")

- Container: `role="status" aria-live="polite" aria-atomic="true"`, announces "Listening" once when recording starts (use a small `useEffect` keyed off `recording` to set the announcement text — avoid announcing every frame).
- Visual: a row of 5 small bars (`h-3 w-1 rounded-full bg-paper/20`), each lit (`bg-lime`) when `level` exceeds a per-bar threshold (e.g. 0.05, 0.12, 0.22, 0.35, 0.5). Scale slightly on activity (`transform scaleY`) for a subtle bouncing meter. `aria-hidden="true"` on the bars themselves — the live region carries the meaning.
- Keep the visible label "Listening…" next to the bars, same typography as the dot version.
- When `level` is 0 for >800ms (silence), keep the label but dim the bars — reassures the user the mic is open without flicker.

### Permission/error edge

- If `AudioContext` creation throws (rare, autoplay policy), fall back silently to the static pulsing-dot version. No user-visible error — the MediaRecorder still works.

## Files touched

- `src/routes/quotes.new.tsx` — analyser refs + rAF loop in `startRecording`, teardown in `mr.onstop` / stop paths, remove `livePreview` (and possibly `liveSupported`) from overlay props, dev assertion, new audio-level cue JSX.

## Out of scope

- No changes to `liveFinalRef` / `liveInterimRef` / `setLivePreview` write sites — transcript capture stays exactly as today.
- No changes to AI prompts, `generateFn`, regenerate merge, or stop-time draft logic shipped in the previous turn.
- No new dependencies. Web Audio is built-in.

## Acceptance

- Overlay component no longer receives `livePreview`; grepping the overlay JSX for `livePreview` returns nothing.
- Dev console errors if a `livePreview` prop is ever re-added.
- While recording: screen-reader announces "Listening" once; visual bars react to voice volume; no transcript text anywhere on screen.
- AI-generated quote content unchanged from current behaviour.
- Stopping recording cleanly releases the AudioContext (no console warnings on repeat record/stop cycles).

1. Verify liveSupported before removing it. The plan says “drop it if only the transcript block used it.” Make sure Lovable actually greps for other usages first — if the overlay uses liveSupported anywhere else (e.g. a “voice not supported on this browser” message), removing it would break that. The plan says to verify; just confirm it did.

2. AudioContext on iOS needs a user gesture. Safari on iPhone/iPad requires the AudioContext to be created/resumed from a user interaction. Since you tap the mic to start recording, that’s fine — but make sure the AudioContext is created (or .resume() called) inside that tap-initiated startRecording, not in an effect that runs later, or the meter will silently sit dead on iOS. The silent fallback means it won’t error, but you’d lose the bars on the exact device Nav uses. Worth confirming.

3. Don’t leak AudioContexts across record cycles. The acceptance criterion already covers this (“no console warnings on repeat record/stop”), but specifically: reuse one AudioContext rather than creating a fresh one each recording, or you’ll accumulate them (browsers cap concurrent contexts). Reusing the lazily-created one and just reconnecting the analyser is cleaner than close-and-recreate every time.