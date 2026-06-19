## Goal

Swap the transcription model in `src/lib/transcribe.functions.ts` from `whisper-1` to `gpt-4o-mini-transcribe` and add a UK-trade priming prompt. Keep everything else (auth, error handling, fallback messages, timeout, ops logging) untouched.

## Changes (single file: `src/lib/transcribe.functions.ts`)

1. **Line 37** — change model:
   ```ts
   form.append("model", "gpt-4o-mini-transcribe");
   ```

2. **After line 38** — add a priming prompt (OpenAI's `/v1/audio/transcriptions` accepts a `prompt` field for both whisper-1 and the gpt-4o transcribe models; it biases recognition toward listed vocabulary):
   ```ts
   form.append(
     "prompt",
     "UK tradesperson describing a job on site. Expect trade terms (boiler, combi, radiator, first-fix, second-fix, Gas Safe, EICR, consumer unit, immersion, soil stack), brand names (Worcester Bosch, Vaillant, Baxi, Ideal, Roca, Geberit, Grohe, Hansgrohe), labour spoken in hours or days, and prices in pounds sterling (e.g. £85, £1,250).",
   );
   ```

3. **Line 39** — keep `response_format: "json"`. The gpt-4o transcribe models support `json` and `text` (not `verbose_json` / `srt` / `vtt`), so this stays valid.

4. **Line 59 / line 64** — rename the log strings from "Whisper" / "whisper" to "transcribe" so ops logs reflect the new model. No behavioural change.

Everything else — consecutive-failure handling at the call site, retry messaging, timeout, 401/429/5xx branches, the "Didn't catch that" empty-result branch — stays exactly as is.

## Optional upgrade (mentioned, not applied)

`gpt-4o-transcribe` (the full, non-mini variant) is a drop-in swap — same endpoint, same request shape, same `prompt` support — and gives the best accuracy on noisy site audio and number-heavy speech, at meaningfully higher per-minute cost. For high-volume voice quoting `gpt-4o-mini-transcribe` is the right default; flip to `gpt-4o-transcribe` only if customers report mis-transcribed prices that the prime above doesn't fix.

## Out of scope

- No change to the client recorder, mime/extension handling, payload cap, or the `applyVoiceEdit` / capture pipelines.
- Not migrating to the Lovable AI Gateway for transcription — the project's existing flow uses OpenAI directly with `OPENAI_API_KEY`, and the request asked only to upgrade the model.
