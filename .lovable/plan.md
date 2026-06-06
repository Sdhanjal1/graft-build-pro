## What's broken

Tapping "New voice quote" on Home should open the full-screen voice overlay. Instead it lands on the regular New Quote form — the overlay never shows.

Reproduced in the preview:
- Click voice-quote card on `/app` → URL ends up at `/quotes/new` (no `?voice=1`) and only the form is rendered. The overlay is **not in the DOM**.
- Direct navigation to `/quotes/new?voice=1` → overlay IS in the DOM (DOM extract shows "TAP TO SPEAK / Start recording / CANCEL"), but URL still has `?voice=1`.

So the bug only bites on the client-side navigation path, which is the only path real users take.

## Root cause

In `src/routes/quotes.new.tsx` (lines 188–198):

```tsx
const [voicePending, setVoicePending] = useState(false);
useEffect(() => {
  if (voiceParam === 1 && !recording && !transcribing && !draft) {
    setVoicePending(true);
    navigate({ to: "/quotes/new", search: {}, replace: true });
  }
}, [voiceParam]);
```

`setVoicePending(true)` and `navigate({ search: {} })` are fired in the same effect. With React's StrictMode double-invoke + the search-param change triggering another effect run (with `voiceParam === undefined`), the `voicePending` state update gets clobbered/dropped before the overlay can render. The URL strip wins; the state update doesn't.

The flag `voicePending` is doing two jobs at once — "remember we wanted voice" and "render the overlay" — but it's stored in state that races the URL change.

## Fix

Stop trying to mirror `voice=1` into local state. Drive the overlay condition off `voiceParam` directly and stop stripping the URL inside the effect. The handlers (`handleVoiceStart`, `handleVoiceClose`) already clear it.

### Edits in `src/routes/quotes.new.tsx`

1. **Remove the URL-stripping effect (lines 188–198)** and the `voicePending` state. Replace with a single derived value:

```tsx
// ?voice=1 means "show the overlay in idle, waiting for the user gesture"
const voicePending = voiceParam === 1;
```

2. **Update `handleVoiceClose`** (~line 223) to clear `voice=1` from the URL when the user dismisses, instead of touching `voicePending`:

```tsx
const handleVoiceClose = () => {
  closeRequestedRef.current = true;
  voiceSessionRef.current++;
  try { recognitionRef.current?.stop?.(); } catch {}
  recognitionRef.current = null;
  // ...existing media-recorder teardown...
  if (voiceParam === 1) navigate({ to: "/quotes/new", search: {}, replace: true });
};
```

3. **Update `handleVoiceStart`** (~line 212) to drop the now-removed `setVoicePending(false)` line; also strip `?voice=1` once recording has actually started so the overlay condition switches to driving off `recording` instead of the URL flag:

```tsx
const handleVoiceStart = async () => {
  closeRequestedRef.current = false;
  setVoiceError(null);
  setLastTranscript(null);
  setLivePreview("");
  liveFinalRef.current = "";
  liveInterimRef.current = "";
  processedPhraseKeysRef.current.clear();
  if (voiceParam === 1) navigate({ to: "/quotes/new", search: {}, replace: true });
  await startRecording();
};
```

4. **Leave the render condition as-is** (line 736) — it already reads `voicePending`, which is now a derived boolean off `voiceParam`:

```tsx
{!draft && (recording || transcribing || voicePending || voiceError) && (
  <VoiceOverlay ... />
)}
```

## Why this works

- Overlay visibility no longer depends on a `setState` that races a URL change — it's derived from the URL the same render it arrives.
- The URL only gets cleaned up after a real user action (Start or Close), where there's no race.
- Direct deep links to `/quotes/new?voice=1` still work (already did).
- iOS user-gesture requirement for `getUserMedia` is preserved — the user still has to tap the lime mic inside the overlay to start recording.

## Verification

1. From `/app`, tap "New voice quote" → full-screen dark overlay opens immediately on the idle "Tap to speak" state.
2. Tap CANCEL → overlay closes, URL is `/quotes/new` (no `?voice=1`), regular form visible.
3. Tap the lime mic → recording starts, URL becomes `/quotes/new`.
4. Reload `/quotes/new?voice=1` directly → overlay still opens in idle.
5. The floating mic FAB (which links to `/quotes/new?voice=1`) still works from every screen.
