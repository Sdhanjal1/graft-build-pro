# Stage 2a — SDP relay for the realtime call

Pure additive. No UI wiring. Sits next to `createRealtimeTranscriptionToken` in the same file.

## What changes

**Edit:** `src/lib/realtime-token.functions.ts` — add one export, `connectRealtimeCall`.

```ts
export const connectRealtimeCall = createServerFn({ method: "POST" })
  .middleware([requireActiveSubscription])
  .inputValidator((input) => z.object({
    sdp: z.string().min(1).max(64_000),       // SDP offers are small; cap defensively
    ephemeralToken: z.string().min(1).max(4_000),
  }).parse(input))
  .handler(async ({ data }) => {
    // POST raw SDP to https://api.openai.com/v1/realtime/calls
    //   Authorization: Bearer <ephemeralToken>
    //   Content-Type: application/sdp
    //   body: data.sdp
    // 30s timeout via AbortSignal.timeout(30_000).
    // On !ok: read text body, log status + truncated body (NO token), throw.
    // On ok: return { answer: await res.text() }.
  });
```

Behaviour mirrors `createRealtimeTranscriptionToken`:

- Gated by `requireActiveSubscription` (which chains `requireSupabaseAuth`).
- Real `OPENAI_API_KEY` is NOT read or sent — the ephemeral token authenticates this call. That's the whole point of the relay.
- 30 s timeout; `TimeoutError`/`AbortError` → friendly "Took too long" message.
- Non-2xx: `console.error("OpenAI Realtime SDP exchange failed", status, body.slice(0, 500))`, then throw `Realtime SDP exchange failed (${status}): ${body.slice(0, 300)}`. The token never appears in the logged/thrown output (it lives only in the request headers).
- Returns `{ answer: string }` — the SDP answer text verbatim.

Adds `import { z } from "zod"` if not already present in the file (currently it isn't — `createRealtimeTranscriptionToken` takes no input). Switches to a `zod`-validated `.inputValidator(...)` so the SDP and token sizes are bounded server-side.

## Deliberate design notes

1. **Why relay instead of letting the browser hit `/v1/realtime/calls` directly?** With a valid ephemeral token the browser technically *can* call `/v1/realtime/calls` itself. Going via our server has two real benefits: (a) the subscription gate runs on the SDP exchange too, so a stale ephemeral token can't be used to start a session after a user's trial lapses mid-flow; (b) future migration off OpenAI (or to a different realtime variant) is a one-file change. Cost is one extra network hop on session start — fine.
2. **Token in the request, not logged.** The ephemeral token is in the `Authorization` header only. The error branch logs status + body slice; neither contains the token. No `console.log` of `data` anywhere.
3. **No `OpenAI-Safety-Identifier` on this call.** The identifier was bound to the token when it was minted (Stage 1). Per the Realtime docs the binding travels with the token, so we don't re-send it here.
4. `**maxBytes` caps.** SDP offers are typically a few KB; `64_000` is generous. Ephemeral tokens are short; `4_000` is way over actual size but cheap insurance.

## What does NOT change

- `createRealtimeTranscriptionToken` — untouched.
- `src/lib/transcribe.functions.ts` — untouched (fallback path).
- No UI, no call sites. Stage 2b will wire the browser's `RTCPeerConnection` and call both functions in sequence.

## Verification (deferred to Stage 2b)

This function can't be meaningfully tested standalone — it needs a real SDP offer from a live `RTCPeerConnection` and a fresh (60 s TTL) ephemeral token. Stage 2b's first deliverable will be the smallest possible "open connection, log transcript events" harness; that's where we verify both Stage 1 and Stage 2a end-to-end.

## Open question

None — spec is unambiguous. Ready to build on approval.

This plan is correct and well-reasoned. The relay-vs-direct justification is sound — and notably, point 1(a) answers the open question I raised: routing the SDP exchange through your server means the subscription gate runs again at session start, so a token minted during a trial can’t be used to open a session after the trial lapses mid-flow. That’s a real security benefit and it settles it: keep the relay, don’t go browser-direct. Good call, and better reasoning than my “maybe we drop 2a” hedge.

Four additional notes to send back before they build:

1. Verify the ephemeral token TTL the plan assumes. The plan’s verification section says “fresh (60s TTL)” — but your Stage 1 test showed 600s, not 60. That’s not a problem, it’s better, but make sure no code anywhere assumes a 60-second expiry. The mint→offer→relay→connect sequence is fast, but I want the assumption corrected in their heads so nobody builds a too-tight refresh timer later.

2. Confirm the SDP answer is returned as raw text, not JSON-wrapped. OpenAI returns the SDP answer as application/sdp text. The plan says return { answer: await res.text() } — good. Just confirm nothing in the TanStack serverFn response path mangles or re-encodes that string (SDP is whitespace/newline-sensitive; if it gets trimmed or re-escaped, the browser’s setRemoteDescription will fail). The answer must arrive at the browser byte-identical.

3. Content-Type on the response check. Add a note: if OpenAI returns a non-2xx that’s actually JSON (an error object) rather than SDP, the error branch should still read it as text safely — which the plan does. Fine as-is, just confirming the error path doesn’t assume SDP shape.

4. One question to answer in the plan, not assume: does requireActiveSubscription middleware add meaningful latency to this call? The SDP exchange is in the critical path of session startup — if the middleware does a fresh DB round-trip to Supabase on every call, that’s added before the connection even opens. Probably fine, but confirm it’s not doing something heavy synchronously, because this call’s speed is felt directly by Nav as “time to first word.”

None of these change the architecture — they’re guardrails on the load-bearing details (token TTL, SDP integrity, startup latency). Send them, approve, and build.

&nbsp;