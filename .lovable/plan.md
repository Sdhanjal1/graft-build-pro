Scope: `src/routes/quotes.new.tsx` only.

## Changes

1. **Timeslice the recorder.** Replace `mr.start()` with `mr.start(1000)` so a chunk is flushed every 1 second, guaranteeing `chunksRef` has data even if stop fires soon after start.

2. **Track recording start time.** Add `const recordStartRef = useRef<number>(0)` and a `const MIN_RECORD_MS = 1000` constant. Set `recordStartRef.current = Date.now()` immediately before `mr.start(1000)`.

3. **Enforce minimum 1s duration in `stopRecording`.** Compute `elapsed = Date.now() - recordStartRef.current`. If `elapsed < MIN_RECORD_MS`, schedule the real `mr.stop()` via `setTimeout` for the remaining ms (re-checking `mr.state !== "inactive"` inside the timeout). Otherwise stop immediately. This applies to user taps, the overlay close button, and the `MAX_RECORD_SECONDS` auto-stop path (which always exceeds 1s, so no behaviour change there).

4. **Raise the empty-blob threshold.** In `mr.onstop`, change `blob.size < 200` to `blob.size < 1000`.

5. **Clearer error copy.** When that guard trips, set:
   `"Recording was too short. Hold the button and speak for at least 2 seconds."`

## Out of scope
- No changes to `transcribe.functions.ts`, UI layout, or other recording entry points beyond what's needed for the min-duration guard.
- No reintroduction of SpeechRecognition.

## Verification
- Tap-stop instantly → recorder still runs to 1s, then either transcribes or shows the new "too short" error.
- Normal 3–10s recording → unchanged, transcribes via Whisper.
- 3-minute auto-stop at `MAX_RECORD_SECONDS` → unchanged.
- Console log on stop still reports `chunks`, `size`, `type` for diagnosability.
