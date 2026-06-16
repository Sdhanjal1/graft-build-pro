## Fix: main mic must set voice target to "desc"

In `src/routes/quotes.new.tsx`, `handleVoiceStart` currently calls `startRecording()` without setting `recordTargetRef.current`. If a previous edit-by-voice or clip action left the ref as `"edit"` or `"clip"`, `startRecording` skips the live path and the main mic silently fails.

### Change (single file: `src/routes/quotes.new.tsx`)

In `handleVoiceStart`, immediately after the existing saving guard and before `startRecording()`:

```ts
recordTargetRef.current = "desc";
setEditVoiceOpen(false);
```

This mirrors how `handleEditByVoice` sets `"edit"` and the clip handler sets `"clip"`, and guarantees the live-session branch in `startRecording` (~line 681) is taken every time the main "Speak the job" mic is tapped.

### Out of scope

- `startRecording` — untouched.
- `src/lib/use-live-quote-session.ts` — untouched.
- `handleEditByVoice`, clip handler, `VoiceOverlay` — untouched.

### Acceptance

- Tap edit-by-voice, cancel, then tap main mic → live session starts, tiles build inline, no overlay.
- Tap clip mic, cancel, then tap main mic → same as above.
- First-load tap of main mic → unchanged (still works).
