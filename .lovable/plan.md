## Step 8 — Voice resilience

A failed transcription currently discards the audio blob — the user must re-record from scratch, which is painful after a 60-second clip on a noisy site. A failed generation shows a red error pill but the only retry path is the same disabled-while-loading button. Progress feedback during generation already exists (`RotatingStatus` + `QUOTE_GEN_MESSAGES`) and is fine.

### Changes — `src/routes/quotes.new.tsx`

**1. Preserve the recorded blob on transcription failure**
- Add a ref `lastBlobRef = useRef<{ blob: Blob; mimeType: string } | null>(null)` and store it in the recorder's `onstop` handler before calling `transcribeFn` (current line ~246-260).
- Clear `lastBlobRef.current = null` only on successful transcription.
- Add `retryTranscription()` helper that reads `lastBlobRef.current`, sets `transcribing=true`, calls `transcribeFn` again, runs the same try/catch as the original path.

**2. "Retry transcription" button in VoiceOverlay**
- New optional prop `onRetryTranscription?: () => void` on `VoiceOverlay`.
- In the error block (line 1030-1031), when `onRetryTranscription` is set, render a small lime pill button under the error message: "Retry without re-recording".
- Pass the helper down from the parent.

**3. Explicit "Retry" affordance on generation failure**
- When `error` is set and not loading, change the lime CTA label to "Retry generate" with a `RotateCw` icon (instead of "Generate quote"). The button is already enabled in this state — this just makes the recovery obvious.

### What stays the same
- No server changes (transcribe / generate handlers untouched).
- Capture flow (`extract-jobs`) is separate and out of scope here.
- Transcript text and clip list are already preserved across errors — no change.
- No new DB columns, env vars, or routes.

### Verification
- Record 5s of audio, force-disconnect network, stop → expect error + "Retry without re-recording"; reconnect, tap retry → transcript appears, no re-record needed.
- Generate a quote with network off → expect red error pill and the CTA flips to "Retry generate" with rotate icon; one tap re-runs `generateFn` with the existing description.
