import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  description: z.string().min(1).max(4000),
  trade: z.string().min(1).max(120),
  vatRegistered: z.boolean(),
});

const LineItemSchema = z.object({
  description: z.string().min(1).max(240),
  qty: z.number().positive().max(1000),
  unit_price: z.number().nonnegative().max(100000),
});

const QuoteSchema = z.object({
  title: z.string().min(1).max(160),
  line_items: z.array(LineItemSchema).min(1).max(20),
});

export type AIGeneratedQuote = z.infer<typeof QuoteSchema>;

const SYSTEM_PROMPT = `You are an expert UK tradesperson estimator generating itemised quotes for small trade businesses in 2026. Use realistic current UK market prices (GBP, ex-VAT) for parts, materials and labour. Labour rates: plumber/heating engineer £55-£75/hr, electrician £55-£75/hr, builder £45-£65/hr. Always include separate line items for materials and labour. Be specific about brands/models where appropriate (Worcester Bosch, Vaillant, Drayton, Geberit, etc). Keep titles concise (under 80 chars). Return between 2 and 8 line items.`;

export const generateAIQuote = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<AIGeneratedQuote> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const userPrompt = `Generate an itemised quote for this job.

Trade: ${data.trade}
VAT registered: ${data.vatRegistered ? "Yes (20% VAT will be added)" : "No"}

Job description:
${data.description}

Return ONLY valid JSON matching this exact shape (no markdown, no commentary):
{
  "title": "Concise quote title",
  "line_items": [
    { "description": "Item or labour description", "qty": 1, "unit_price": 0 }
  ]
}

Unit prices must be ex-VAT in GBP. Quantities can be decimal (e.g. 1.5 for 1.5 hours).`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("Anthropic API error", res.status, txt);
      throw new Error(`Claude API error (${res.status}): ${txt.slice(0, 200)}`);
    }

    const payload = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = payload.content?.find((c) => c.type === "text")?.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Claude returned no JSON");

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error("Claude returned malformed JSON");
    }
    return QuoteSchema.parse(parsed);
  });
