import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  audioBase64: z.string().min(1),
  mimeType: z.string().min(1).max(100),
});

export const transcribeAudio = createServerFn({ method: "POST" })
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error("Transcription is not configured (missing ElevenLabs API key).");
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
    form.append("model_id", "scribe_v1");
    form.append("language_code", "eng");
    form.append("tag_audio_events", "false");
    form.append("diarize", "false");

    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: form,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("ElevenLabs Scribe error", res.status, errText);
      if (res.status === 401) {
        throw new Error("ElevenLabs API key is invalid. Update the key and try again.");
      }
      if (res.status === 429) {
        throw new Error("ElevenLabs rate limit hit. Wait a moment and try again.");
      }
      throw new Error(`Transcription failed (${res.status})`);
    }

    const json = (await res.json()) as { text?: string };
    const text = (json.text || "").trim();
    if (!text) throw new Error("No speech detected");
    return { text };
  });
