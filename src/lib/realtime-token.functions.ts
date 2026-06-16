import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveSubscription } from "@/lib/require-active-subscription";

/**
 * Mints a short-lived OpenAI Realtime ephemeral token for in-browser
 * transcription sessions. The real OPENAI_API_KEY never leaves the server.
 *
 * Gated identically to transcribeAudio: requireActiveSubscription, which
 * itself chains requireSupabaseAuth (trial / active / past_due all allowed —
 * see require-active-subscription.ts).
 *
 * The authenticated Supabase user id is sent as OpenAI-Safety-Identifier so
 * the ephemeral token is bound to that user for abuse monitoring. The browser
 * never supplies or sees this — it's derived server-side from the auth
 * context, so it isn't spoofable.
 */
export const createRealtimeTranscriptionToken = createServerFn({ method: "POST" })
  .middleware([requireActiveSubscription])
  .handler(async ({ context }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("Realtime transcription is not configured (missing OpenAI API key).");
    }

    const { userId } = context as { userId: string };

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    // Opaque Supabase user id — stable, non-PII, suitable as a safety identifier.
    if (userId) headers["OpenAI-Safety-Identifier"] = userId;

    let res: Response;
    try {
      res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
        method: "POST",
        headers,
        body: JSON.stringify({
          session: {
            type: "transcription",
            audio: {
              input: {
                format: { type: "audio/pcm", rate: 24000 },
                transcription: {
                  model: "gpt-4o-mini-transcribe",
                  language: "en",
                  prompt:
                    "UK tradesperson describing a job for a quote. Trade terms and brands like Worcester Bosch, Vaillant, Baxi, Ideal, Drayton, Geberit, consumer unit, EICR, power flush, magnetic filter, double-panel radiator, soil pipe, isolation valve. Prices in pounds sterling.",
                },
                turn_detection: {
                  type: "server_vad",
                  silence_duration_ms: 700,
                },
              },
            },
          },
        }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name === "TimeoutError" || name === "AbortError") {
        throw new Error("Took too long — check your connection and try again.");
      }
      throw err;
    }

    if (!res.ok) {
      // Read body for diagnosability. The OpenAI error body contains the
      // status + an error message describing the session shape problem; it
      // does NOT echo our Authorization header or the (not-yet-minted)
      // ephemeral token, so a truncated slice is safe to surface.
      const body = await res.text().catch(() => "");
      console.error("OpenAI Realtime token mint failed", res.status, body.slice(0, 500));
      if (res.status === 401) {
        throw new Error("OpenAI API key is invalid. Update the key and try again.");
      }
      if (res.status === 429) {
        throw new Error("OpenAI rate limit hit. Wait a moment and try again.");
      }
      throw new Error(`Realtime token mint failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      client_secret?: { value?: string; expires_at?: number | string | null };
      value?: string;
      expires_at?: number | string | null;
    };

    // Defensive extraction — keep both shapes so a minor API version
    // difference doesn't break this silently.
    const token = json?.client_secret?.value ?? json?.value;
    const expiresAt = json?.client_secret?.expires_at ?? json?.expires_at ?? null;

    if (!token) {
      console.error("OpenAI Realtime response missing client_secret.value", json);
      throw new Error("Realtime token mint returned no token.");
    }

    return { token, expiresAt };
  });

/**
 * Relays the WebRTC SDP handshake with OpenAI's Realtime API.
 *
 * The browser creates an RTCPeerConnection, generates an SDP offer, and posts
 * it through this server function alongside the ephemeral token it just
 * minted. We forward the SDP to OpenAI authenticated by the ephemeral token —
 * the real OPENAI_API_KEY is never read or sent here. The SDP answer is
 * returned verbatim for the browser to feed into setRemoteDescription.
 *
 * Why relay instead of letting the browser call /v1/realtime/calls directly:
 *  - requireActiveSubscription runs on the SDP exchange too, so a token
 *    minted just before a trial lapse can't be used to open a session.
 *  - Single chokepoint for future provider/model changes.
 *
 * Notes for callers:
 *  - Ephemeral tokens issued by Stage 1 currently have a ~600s TTL (observed),
 *    not 60s — do NOT build tight refresh timers around an assumed 60s.
 *  - The SDP answer is whitespace/newline-sensitive; it MUST reach the
 *    browser byte-identical. We return it as a plain string in a JSON DTO;
 *    TanStack's JSON serialization preserves the string exactly.
 *  - The error branch reads the body as text (never assumes SDP shape), so
 *    JSON error envelopes from OpenAI are logged safely.
 *  - requireActiveSubscription does one Supabase SELECT (1 row, indexed by
 *    user_id) — see require-active-subscription.ts. Single round-trip; not a
 *    meaningful contributor to time-to-first-word.
 */
export const connectRealtimeCall = createServerFn({ method: "POST" })
  .middleware([requireActiveSubscription])
  .inputValidator((input) =>
    z
      .object({
        sdp: z.string().min(1).max(64_000),
        ephemeralToken: z.string().min(1).max(4_000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    let res: Response;
    try {
      res = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${data.ephemeralToken}`,
          "Content-Type": "application/sdp",
        },
        body: data.sdp,
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name === "TimeoutError" || name === "AbortError") {
        throw new Error("Took too long — check your connection and try again.");
      }
      throw err;
    }

    if (!res.ok) {
      // Body may be SDP, plain text, or a JSON error envelope — read as text
      // so we don't assume a shape. The ephemeral token lives only in the
      // request Authorization header above, so it is NOT in the response body
      // and will not leak via this log/throw.
      const body = await res.text().catch(() => "");
      console.error("OpenAI Realtime SDP exchange failed", res.status, body.slice(0, 500));
      if (res.status === 401) {
        throw new Error("Realtime session token was rejected. Please try again.");
      }
      if (res.status === 429) {
        throw new Error("OpenAI rate limit hit. Wait a moment and try again.");
      }
      throw new Error(`Realtime SDP exchange failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const answer = await res.text();
    if (!answer) {
      throw new Error("Realtime SDP exchange returned an empty answer.");
    }
    return { answer };
  });
