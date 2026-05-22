import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveSubscription } from "@/lib/require-active-subscription";

const InputSchema = z.object({
  transcript: z.string().min(1).max(8000),
  trade: z.string().max(120).optional(),
});

const OutputSchema = z.object({
  jobs: z.array(z.string().min(1).max(240)).min(1).max(30),
});

export type ExtractedJobs = z.infer<typeof OutputSchema>;

const SYSTEM_PROMPT = `You extract a clean list of individual jobs/items to quote from a tradesperson's spoken site-walk transcript. Output one concise job per array entry (5-12 words each, sentence case, no numbering, no trailing periods). Merge filler words, fix obvious speech-to-text errors, and split distinct jobs even if spoken in one sentence. Do NOT invent jobs that weren't mentioned. Do NOT include prices or quantities.`;

export const extractJobsFromTranscript = createServerFn({ method: "POST" })
  .middleware([requireActiveSubscription])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<ExtractedJobs> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const userPrompt = `${data.trade ? `Trade: ${data.trade}\n` : ""}Transcript:
"""
${data.transcript}
"""

Return ONLY valid JSON in this exact shape (no markdown, no commentary):
{ "jobs": ["job one", "job two"] }`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Lovable-API-Key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("Lovable AI error", res.status, txt);
      if (res.status === 429) throw new Error("Rate limited. Try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Settings.");
      throw new Error(`AI error (${res.status})`);
    }

    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = payload.choices?.[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI returned no JSON");

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error("AI returned malformed JSON");
    }
    return OutputSchema.parse(parsed);
  });
