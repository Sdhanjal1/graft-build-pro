import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveSubscription } from "@/lib/require-active-subscription";

const InputSchema = z.object({
  items: z.array(z.string().min(1).max(500)).min(1).max(40),
  trade: z.string().min(1).max(120),
  vatRegistered: z.boolean(),
  customerName: z.string().max(200).optional(),
  address: z.string().max(400).optional(),
});

const LineItemSchema = z.object({
  description: z.string().min(1).max(240),
  qty: z.number().positive().max(1000),
  unit_price: z.number().nonnegative().max(100000),
});

const QuoteSchema = z.object({
  title: z.string().min(1).max(160),
  line_items: z.array(LineItemSchema).min(1).max(30),
});

export type AICaptureQuote = z.infer<typeof QuoteSchema>;

const SYSTEM_PROMPT = `You are an expert UK tradesperson estimator generating itemised quotes for small trade businesses in 2026. Use realistic current UK market prices (GBP, ex-VAT) for parts, materials and labour. Labour rates: plumber/heating engineer £55-£75/hr, electrician £55-£75/hr, builder £45-£65/hr. Always include separate line items for materials and labour where it makes sense. Be specific about brands/models where appropriate (Worcester Bosch, Vaillant, Drayton, Geberit, etc).

The following items were captured individually on site by a tradesperson walking through a property. Treat them as a complete job list and generate a professional itemised quote. Each captured item should become one or more line items in the quote with accurate 2026 UK pricing. Group related items logically. Add appropriate materials to each labour item. Generate a professional job title summarising all the work.`;

export const generateCaptureQuote = createServerFn({ method: "POST" })
  .middleware([requireActiveSubscription])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<AICaptureQuote> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const itemList = data.items.map((d, i) => `${i + 1}. ${d}`).join("\n");

    const userPrompt = `Trade: ${data.trade}
VAT registered: ${data.vatRegistered ? "Yes (20% VAT will be added)" : "No"}
${data.customerName ? `Customer: ${data.customerName}\n` : ""}${data.address ? `Address: ${data.address}\n` : ""}
Items captured on site:
${itemList}

Return ONLY valid JSON matching this exact shape (no markdown, no commentary):
{
  "title": "Concise job title summarising the work",
  "line_items": [
    { "description": "Item or labour description", "qty": 1, "unit_price": 0 }
  ]
}

Unit prices must be ex-VAT in GBP. Quantities can be decimal.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 3072,
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
