# Stage 2b — Live transcript harness (dev-only)

Smallest possible end-to-end proof that words stream in live. Diagnostic, ugly on purpose.

## Where it goes

**Edit:** `src/routes/dev-token-test.tsx` (the existing Stage 1 harness). Add the harness below the existing mint button — same route, no new files, no nav links. Leave the mint button in place: it's still useful for isolated token tests.

Nothing else is touched. `quotes.new.tsx`, `VoiceOverlay`, `runTranscribe`, `finaliseFromAudio` are all untouched.

## What the harness does

A single **"Start listening"** button runs:

1. `mint = useServerFn(createRealtimeTranscriptionToken)` → `{ token }`. Status: `"minting"`.
2. `getUserMedia({ audio: true })`. Status: `"requesting mic"`.
3. Build `RTCPeerConnection` (default config, no custom STUN). Add the mic track. Create the data channel `"oai-events"` BEFORE `createOffer` so it's negotiated in the SDP. Status: `"connecting"`.
4. `await pc.setLocalDescription(await pc.createOffer())`, then wait for ICE gathering to complete (the SDP relay is a single HTTP exchange, no trickle ICE — we need a complete SDP). A small `waitForIceComplete(pc)` helper: resolves immediately if `iceGatheringState === "complete"`, else listens for `icegatheringstatechange` with a 3 s safety timeout.
5. `connect = useServerFn(connectRealtimeCall)` with `{ sdp: pc.localDescription.sdp, ephemeralToken: token }` → `{ answer }`. Status stays `"connecting"`.
6. `await pc.setRemoteDescription({ type: "answer", sdp: answer })`.
7. On data-channel `open`, status → `"listening"`.

## Event handling on `oai-events`

`channel.onmessage = (e) => { const evt = JSON.parse(e.data); console.log("[oai]", evt.type, evt); switch(...) }`.

Handled types:
- `conversation.item.input_audio_transcription.delta` → append `evt.delta` to a `interim` string state.
- `conversation.item.input_audio_transcription.completed` → look up `evt.item_id` in a `Set` of seen ids; if new, append `evt.transcript + " "` to `committed` state, clear `interim`, add id to set.
- `input_audio_buffer.speech_started` → boolean `speaking = true`.
- `input_audio_buffer.speech_stopped` → `speaking = false`.
- `error` (or any event whose type starts with `error`) → push to an on-screen error list and console.error it.
- Anything else: console.log only (we want the full stream visible during diagnosis).

## On-screen

Three blocks, no styling beyond inline monospace + a couple of borders to match the existing harness aesthetic:

1. **Status line**: `idle | minting | requesting mic | connecting | listening | error | stopped` + a green/red dot. When `speaking`, append `· speaking…`.
2. **Committed transcript**: large readable block, the finalised text accumulated.
3. **Interim transcript**: same block visually below it, greyed (`opacity: 0.55`), italic — streams as words arrive, clears on each `completed`.
4. **Error panel**: red box, shown only when populated. Each step is wrapped in try/catch; on throw, `setStatus("error")`, push `err.message` to the list, fully tear down (see Stop).

A **Stop** button (only enabled in non-idle states):
- `channel?.close()`
- `stream?.getTracks().forEach(t => t.stop())` (releases the mic light)
- `pc?.close()`
- Clear all refs, status → `"stopped"`. Committed transcript stays on screen so we can read what was captured.

## Refs vs state

- `pcRef`, `channelRef`, `streamRef`, `seenItemIdsRef` (a `Set<string>`) — refs, no re-render needed.
- `status`, `committed`, `interim`, `speaking`, `errors[]` — state, drive the UI.
- A `useEffect` cleanup on unmount runs the same Stop teardown so navigating away during a session releases the mic.

## Deliberate omissions (for this stage)

- No silence/end-of-turn handling beyond logging the events.
- No reconnect on failure — Stop and restart.
- No `RTCPeerConnection` config tweaks; browser defaults are sufficient for the OpenAI relay.
- No `addTransceiver("audio", { direction: "recvonly" })`. Transcription sessions don't return audio; data channel works independent of media direction.
- No styling polish, no haptics, no animations. This is a diagnostic.

## Verification (the whole point of this stage)

1. Visit `/dev-token-test` signed in, tap **Start listening**.
2. Status reaches `"listening"` within ~1–2 s on good network.
3. Speak: greyed interim text appears within a few hundred ms; on pause, it commits to the black text and clears.
4. Console shows a continuous stream of `[oai] conversation.item.input_audio_transcription.delta` and one `…completed` per phrase, plus `speech_started/stopped`.
5. Stop releases the mic (browser tab indicator disappears).

If any of those fail, the console log of the full event stream + the on-screen error panel is the diagnosis surface for the next iteration. The mint button stays in place so we can confirm whether a failure is at the token layer or downstream.

## Open question

None. Spec is precise; harness is a contained additive change to one existing dev-only route.
