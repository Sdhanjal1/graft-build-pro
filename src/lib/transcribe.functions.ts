import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveSubscription } from "@/lib/require-active-subscription";

// Cap base64 payload at ~10 MB (≈ 7.5 MB raw audio) to bound per-call cost.
const MAX_AUDIO_B64_BYTES = 10 * 1024 * 1024;

const InputSchema = z.object({
  audioBase64: z.string().min(1).max(MAX_AUDIO_B64_BYTES),
  mimeType: z.string().min(1).max(100),
});

export const transcribeAudio = createServerFn({ method: "POST" })
  .middleware([requireActiveSubscription])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("Transcription is not configured (missing OpenAI API key).");
    }

    const bytes = Buffer.from(data.audioBase64, "base64");
    const blob = new Blob([bytes], { type: data.mimeType });

    const ext = data.mimeType.includes("webm")
      ? "webm"
      : data.mimeType.includes("mp4") || data.mimeType.includes("mp4a")
        ? "mp4"
        : data.mimeType.includes("ogg")
          ? "ogg"
          : data.mimeType.includes("wav")
            ? "wav"
            : "webm";

    const form = new FormData();
    form.append("file", blob, `recording.${ext}`);
    form.append("model", "gpt-4o-mini-transcribe");
    form.append("language", "en");
    form.append("response_format", "json");
    form.append(
      "prompt",
      "UK tradesperson describing a job on site. Expect trade terms (boiler, combi, radiator, first-fix, second-fix, Gas Safe, EICR, consumer unit, immersion, soil stack), brand names (Worcester Bosch, Vaillant, Baxi, Ideal, Roca, Geberit, Grohe, Hansgrohe), labour spoken in hours or days, and prices in pounds sterling (e.g. £85, £1,250).",
    );

    let res: Response;
    try {
      res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
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
      const errText = await res.text().catch(() => "");
      console.error("OpenAI transcribe error", res.status, errText);
      try {
        const { logErrorEvent } = await import("@/lib/ops-errors.server");
        await logErrorEvent({
          context: "voice.transcribe",
          message: `transcribe ${res.status}: ${errText.slice(0, 500)}`,
        });
      } catch {}
      if (res.status === 401 || res.status === 403) {
        throw new Error("Voice isn't set up right now. Try again in a moment.");
      }
      if (res.status === 429 || res.status >= 500) {
        throw new Error("Busy right now — give it a few seconds and try again.");
      }
      throw new Error("Couldn't hear that — try again in a quieter spot.");
    }

    const json = (await res.json()) as { text?: string };
    const text = (json.text || "").trim();
    if (!text) throw new Error("Didn't catch that — go again.");
    return { text };
  });
