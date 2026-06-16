# Stage 1 — Ephemeral Realtime token server function

Pure additive change. No UI wiring, no other files touched. This proves the security foundation before any WebRTC work in Stage 2.

## What changes

**New file:** `src/lib/realtime-token.functions.ts`

A `createServerFn({ method: "POST" })` named `createRealtimeTranscriptionToken` that:

- Reads `process.env.OPENAI_API_KEY` (same pattern as `transcribe.functions.ts`).
- Accepts an optional `{ userId?: string }` input and, when present, sends it as the `OpenAI-Safety-Identifier` header so the ephemeral token is bound to that user for abuse monitoring (browser never sends it).
- `POST`s to `https://api.openai.com/v1/realtime/client_secrets` with a `session` body of `type: "transcription"`, `gpt-4o-mini-transcribe`, `language: "en"`, the existing UK-trade prompt, PCM 24 kHz input, and `server_vad` with `silence_duration_ms: 700`.
- 60s timeout via `AbortSignal.timeout(60_000)`, matching the surrounding code style.
- On non-2xx, throws with status + truncated body for diagnosability (matches `transcribeAudio` error tone).
- Returns only `{ token, expiresAt }` — never the real key, never the full provider payload.

## Deliberate deviations from the pasted snippet

These are small but worth flagging so there are no surprises on apply:

1. `**.inputValidator`, not `.validator`.** Current TanStack Start uses `.inputValidator()` in this codebase (see `transcribe.functions.ts`); `.validator()` would fail to typecheck. The behaviour is identical.
2. **No `requireActiveSubscription` middleware on this stage.** `transcribeAudio` gates on subscription, and live transcription will cost money per session, so eventually this must gate too. For Stage 1 the goal is "prove the token mints"; I'll leave a `TODO` comment in the file noting that `requireSupabaseAuth` + `requireActiveSubscription` should be added before Stage 2 wires it to the client. Call out if you'd rather I add the gating now — it's one line and one import, but it means you can't test-call it without a signed-in, subscribed user.
3. `**userId` source.** The snippet takes `userId` from the client. That's spoofable — a malicious client could pass anyone's id. The right shape is to derive `userId` server-side from `requireSupabaseAuth` context (which lands in Stage 2 prep above). For Stage 1, I'll accept it as input but mark it `TODO: replace with context.userId once auth middleware is added`, so we don't bake in a foot-gun.

## What does NOT change

- `src/lib/transcribe.functions.ts` — untouched; remains the fallback path.
- `src/routes/quotes.new.tsx` — no call site, no import. Stage 1 is provable from a one-off invocation alone.
- No new secrets, no new env vars (`OPENAI_API_KEY` is already configured).
- No `src/start.ts` changes (no new middleware in this stage).

## How to verify before Stage 2

Once built, invoke `createRealtimeTranscriptionToken` once (temporary button, dev console, or `stack_modern--invoke-server-function`). Success = response object with `token` (string, typically `ek_…`) and a future `expiresAt`. Failure = paste the status + body and I'll adjust the `session` nesting; OpenAI's Realtime config shape has minor version variance and the error message tells us exactly what to change.

## Open questions before I implement

1. **Add `requireSupabaseAuth` + `requireActiveSubscription` now, or in Stage 2?** Recommendation: add now (one extra import, one extra `.middleware([...])` line, and derive `userId` from `context` instead of input) so we never ship an unauthenticated public token-minting endpoint, even briefly. Confirm and I'll include it.

1. Confirmed: add the gating now.

Add requireSupabaseAuth + requireActiveSubscription middleware to createRealtimeTranscriptionToken in this stage. Derive userId server-side from the auth context for the OpenAI-Safety-Identifier header. Remove the client-supplied userId input entirely — don’t accept it as a parameter at all, so there’s nothing spoofable. No TODO placeholders; ship it fully gated.

2. Match the exact middleware pattern from transcribeAudio.

Use whatever import paths and middleware-array syntax transcribeAudio already uses for requireSupabaseAuth / requireActiveSubscription — don’t introduce a new pattern. And read how transcribeAudio pulls the user id out of context (the field name), so the safety identifier uses the same source of truth.

3. Keep the userId privacy-preserving.

The safety identifier should be a stable internal id (the Supabase user id is fine) — not an email or anything personally identifying. If the auth context exposes both, use the opaque user id.

4. Don’t log the token or the real key.

In the error-handling branch, make sure the truncated body that gets thrown/logged can’t include the ephemeral token value or any Authorization header. Log status + a safe slice of the error body only.

5. Confirm the response-shape hedge stays.

Keep the defensive extraction (client_secret?.value ?? value, client_secret?.expires_at ?? expires_at) so a minor API version difference doesn’t break it silently — and keep the note that a 400 means we adjust the session nesting against the actual error message.

6. One question back for Lovable to answer in the plan, not assume:

Does requireActiveSubscription currently allow users still inside their 14-day free trial? 