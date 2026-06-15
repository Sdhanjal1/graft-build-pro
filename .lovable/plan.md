# Make Whisper authoritative for the final quote

Live Web Speech tiles stay as a real-time preview during recording, but on stop the committed draft is rebuilt from Whisper's transcript of the recorded audio — single path, no merge from live tiles.

## File

`src/routes/quotes.new.tsx`

## 1. Add `finaliseFromAudio` helper

Define near the existing voice helpers (alongside `runTranscribe` / `runRegenerate`):

```ts
const finaliseFromAudio = async (blob: Blob, mimeType: string, sessionId: number) => {
  setTranscribing(true);
  try {
    const audioBase64 = await blobToBase64(blob); // same util runTranscribe uses
    const { text } = await transcribeFn({ data: { audioBase64, mimeType } });
    if (sessionId !== voiceSessionRef.current || closeRequestedRef.current) return;
    const transcript = (text || "").trim();
    if (!transcript) {
      setVoiceError("We didn't catch any speech. Tap the mic and describe the job out loud.");
      return;
    }
    const g = await generateFn({ data: { description: transcript, trade, vatRegistered: vat } });
    if (sessionId !== voiceSessionRef.current || closeRequestedRef.current) return;

    setDraft({ title: g.title, line_items: g.line_items });
    originalDraftRef.current = JSON.stringify(g.line_items);
    setDesc(g.clean_description || transcript);
    const ec = g.extracted_customer;
    if (ec?.name && !clientName.trim()) setClientName(ec.name);
    if (ec?.phone && !clientPhone.trim()) setClientPhone(ec.phone);

    // Tear down live preview state.
    setLiveItems([]);
    liveItemsRef.current = [];
    setLivePreview("");
    liveFinalRef.current = "";
    liveInterimRef.current = "";
    clearPendingItems();

    feedback("success");
    playSample("ding");
    requestAnimationFrame(() => {
      draftRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  } catch (err) {
    console.error(err);
    setVoiceError(err instanceof Error ? err.message : "Couldn't finalise the recording.");
  } finally {
    setTranscribing(false);
  }
};
```

Notes:

- Does NOT call `appendTranscript` or `runTranscribe`.
- Does NOT guard on `!draft` — always rebuilds.
- Uses whatever base64 helper `runTranscribe` already uses (will read its implementation while editing).

## 2. Rewrite `mr.onstop` (lines ~790–930)

Collapse to a single post-stop path:

- Keep all teardown (interval clear, recognition stop, stream stop, blob assembly).
- Keep the early bail: `closeRequestedRef.current || sessionId !== voiceSessionRef.current`.
- Keep clip mode branch unchanged (still uses `runTranscribe`).
- After clip-mode branch, in normal voice mode:
  - Stop the live debounce timer.
  - If `blob.size < 1000`: set the existing "We didn't catch any speech…" error and return.
  - Otherwise: `lastBlobRef.current = { blob, mimeType: blobType }; await finaliseFromAudio(blob, blobType, sessionId);`
- Remove:
  - "INSTANT-STOP BRANCH" (tiles → draft path, lines ~823–885).
  - "ZERO-TILES BRANCH" Whisper-fallback path (lines ~887–929) — replaced by the single call.
  - Background `runRegenerate` + late-merge logic.
  - Final-interim flush into `liveFinalRef` (no longer drives the draft).

## 3. Stop live pipeline feeding committed draft

`regenerateLiveQuote` continues to update `liveItems` for the on-screen preview while recording. Confirmed: nothing else writes its output into `draft` outside of the deleted `mr.onstop` branches, so no further changes needed beyond step 2.

## 4. Untouched

- `runTranscribe`, `appendTranscript`, `applyVoiceEdit`, typed-description flow.
- Clip / on-site mode.
- Web Speech `onresult`, `liveItems` tiles, streaming preview, haptics/sound during recording.
- `voiceSessionRef` / `closeRequestedRef` lifecycle.

## Result

While talking: live tiles preview as today. On stop: brief "finalising" spinner → Whisper transcribes the audio → one accurate draft built from the authoritative transcript, with no stuck mis-heard tiles.

This plan is solid and faithfully implements Prompt 2. The finaliseFromAudio helper does exactly what it should — direct transcribeFn → generateFn, no appendTranscript, no !draft guard, proper session-staleness checks on both async boundaries. The mr.onstop collapse to a single path is right.

Three things to check before or during the build:

1. retryTranscription may now be orphaned. The plan sets lastBlobRef.current = { blob, mimeType: blobType } before finalising, which is good — it means the existing retryTranscription (line 582) still has a blob to retry from. But confirm retryTranscription calls a path that rebuilds the draft. It currently calls runTranscribe, which has the !draft guard — so if a voice error leaves a partial draft, “retry” could silently no-op. Ask Lovable to point retryTranscription at finaliseFromAudio too, using the current sessionId, so retry behaves like a normal finalise.

2. The spinner state. The plan uses setTranscribing(true/false). Confirm that’s the same flag the overlay reads to show the “finalising” UI — there were both transcribing and building states in the live pipeline. You want the user to see a clear spinner during the Whisper pass, not a dead screen. If transcribing already drives a visible spinner (it did in the old zero-tiles branch), you’re fine.

3. Web Speech teardown timing. mr.onstop stops recognitionRef, but rec.onend (line 971) auto-restarts recognition if mediaRecorderRef.current?.state === "recording". On stop the recorder state flips to inactive first, so it shouldn’t restart — but worth confirming the order holds so a stray recognition session doesn’t fire after finalise. Low risk; just eyeball it after build.

None of these change the core plan. Apply it. The one you actually want to verify by testing is #2 — record a quote and make sure the finalising beat shows a spinner, not blank.