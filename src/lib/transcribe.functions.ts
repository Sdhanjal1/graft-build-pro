import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  audioBase64: z.string().min(1),
  mimeType: z.string().min(1).max(100),
});

export const transcribeAudio = createServerFn({ method: "POST" })
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("Transcription is not configured (missing API key).");
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
      if (res.status === 429 && errText.includes("insufficient_quota")) {
        throw new Error(
          "OpenAI quota is exhausted. Update the OpenAI key or billing, or use a browser that supports live voice typing.",
        );
      }
      throw new Error(`Transcription failed (${res.status})`);
    }

    const json = (await res.json()) as { text?: string };
    const text = (json.text || "").trim();
    if (!text) throw new Error("No speech detected");
    return { text };
  });
