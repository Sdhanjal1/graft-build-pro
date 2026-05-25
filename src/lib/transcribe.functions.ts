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
    form.append("model", "whisper-1");
    form.append("language", "en");
    form.append("response_format", "json");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("OpenAI Whisper error", res.status, errText);
      if (res.status === 401) {
        throw new Error("OpenAI API key is invalid. Update the key and try again.");
      }
      if (res.status === 429) {
        throw new Error("OpenAI rate limit hit. Wait a moment and try again.");
      }
      throw new Error(`Transcription failed (${res.status})`);
    }

    const json = (await res.json()) as { text?: string };
    const text = (json.text || "").trim();
    if (!text) throw new Error("No speech detected");
    return { text };
  });
