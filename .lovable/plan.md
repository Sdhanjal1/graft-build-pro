
# Upgrade Whisper transcription to gpt-4o-mini-transcribe

Small, surgical change to `src/lib/transcribe.functions.ts` to improve accuracy on UK trade vocabulary, brand names and spoken prices.

## Change

In the `FormData` block inside the `handler`:

1. Swap the model:
   - `form.append("model", "whisper-1")` → `form.append("model", "gpt-4o-mini-transcribe")`
2. Add a priming prompt immediately after `form.append("response_format", "json")`:
   ```ts
   form.append(
     "prompt",
     "UK tradesperson describing a job for a quote. Expect trade terms and brand names like Worcester Bosch, Vaillant, Baxi, Ideal, Drayton, Geberit, Grundfos, Hep2O, consumer unit, EICR, power flush, magnetic filter, double-panel radiator, soil pipe, isolation valve. Prices are in pounds sterling, e.g. £85, £1,200, 'two fifty', 'a hundred and twenty'."
   );
   ```

## Unchanged

- Endpoint `https://api.openai.com/v1/audio/transcriptions`
- `language: "en"`, `response_format: "json"`
- Auth header, timeout, file blob handling, extension picking
- Error branches (401, 429, generic, timeout) and the `{ text }` return shape
- No `temperature` field (this model rejects it)

## Files touched

- `src/lib/transcribe.functions.ts` — two lines changed, one line added
