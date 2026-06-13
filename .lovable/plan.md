# Show recording screen before mic permission prompt

Goal: tapping "Speak the job" renders the dark voice overlay instantly so the iOS mic permission prompt appears over it (in context), and recording auto-starts on Allow.

## Changes (all in `src/routes/quotes.new.tsx`)

1. **New state** near other voice state (around line 1109 area):
  ```ts
   const [voiceOpening, setVoiceOpening] = useState(false);
  ```
2. `**handleVoiceStart` (~line 387)** — set the flag synchronously before `startRecording()` so the overlay mounts during the same user gesture, and clear it on failure:
  ```ts
   setVoiceOpening(true);
   …existing resets…
   if (voiceParam === 1) navigate(…);
   try {
     await startRecording();
   } catch (e) {
     setVoiceOpening(false);
     throw e;
   }
  ```
   No `await` is added before `getUserMedia` inside `startRecording`, preserving the iOS user-gesture chain.
3. `**handleEditByVoice` (~line 398)** — same treatment (set/clear `voiceOpening`) so the edit-voice entry also shows the overlay immediately.
4. **Overlay visibility (~line 1197)** — include `voiceOpening`:
  ```tsx
   {(editVoiceOpen || !draft) && (recording || transcribing || voicePending || voiceError || voiceOpening) && (
  ```
5. **Auto-clear once recording begins**:
  ```ts
   useEffect(() => { if (recording) setVoiceOpening(false); }, [recording]);
  ```
   Also clear inside `handleVoiceClose` and in the permission-denied / catch path in `startRecording` (alongside the existing `setVoiceError` for denied).
6. **Denied / Cancel path** — when `getUserMedia` rejects (NotAllowedError or user-cancel), clear `voiceOpening` and let the existing mic-permission-denied fallback (the inline "mic's off — type instead" state) render, rather than leaving an idle overlay.

## Out of scope

Recording logic, AI generation, typed flow.

## Acceptance

- First tap of "Speak the job" → dark recording overlay shows immediately with iOS mic prompt over it.
- Allow → recording starts with no extra tap.
- Cancel/Deny → mic-denied fallback shows; no stuck idle overlay.
- Returning users (permission already granted) → straight to recording, unchanged.

Two small things to verify in the diff, neither a blocker:

1. The voiceOpening-true, not-yet-recording window shows the idle overlay — which displays the “tap to start” mic UI behind the iOS prompt. That’s fine functionally (the modal blocks interaction, and recording auto-starts on Allow), but glance at it on the device: if the idle copy (“New voice quote / tap to start”) flashes oddly behind the prompt, you might later want it to read “Starting…” while voiceOpening. Not needed now — just check it doesn’t look broken.

2. Confirm the denied path actually reaches the fallback. The plan assumes the mic-permission-denied state exists and renders. If that earlier fallback hasn’t actually landed yet, the Cancel path will clear voiceOpening and drop the user back to the card page with a voiceError — which is acceptable (not stuck), but verify it’s not a blank or confusing state. If the denied fallback isn’t in yet, that’s the one to prioritise over this, since Cancel is a real path a first-time user will hit.