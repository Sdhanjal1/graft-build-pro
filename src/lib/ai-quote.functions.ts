import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveSubscription } from "@/lib/require-active-subscription";
import { fetchTopPatterns, patternsForPrompt } from "@/lib/pricing-patterns.functions";
import { tradeGuidance } from "@/lib/ai-trade-guidance";
import { rankPatternsForJob } from "@/lib/pricing-patterns";


const InputSchema = z.object({
  description: z.string().min(1).max(4000),
  trade: z.string().min(1).max(120),
  vatRegistered: z.boolean(),
});

const LineItemSchema = z.object({
  description: z.string().min(1).max(240),
  qty: z.number().positive().max(1000),
  unit_price: z.number().nonnegative().max(100000),
  source: z.enum(["voice", "learned", "ai"]).optional().default("ai"),
  category: z.enum(["labour", "materials", "certificate", "cis_labour", "other"]).optional().default("other"),
  unit: z.enum(["qty", "hours", "days"]).optional().default("qty"),
});

const QuoteSchema = z.object({
  title: z.string().min(1).max(160),
  clean_description: z.string().min(1).max(1000),
  extracted_customer: z
    .object({
      name: z.string().max(200).optional(),
      phone: z.string().max(50).optional(),
      email: z.string().max(200).optional(),
    })
    .optional(),
  line_items: z.array(LineItemSchema).min(1).max(20),
});

export type AIGeneratedQuote = z.infer<typeof QuoteSchema>;

const SYSTEM_PROMPT = `You are an expert UK tradesperson estimator generating itemised quotes for small trade businesses in 2026. Use realistic current UK market prices (GBP, ex-VAT) for parts, materials and labour. Labour rates: plumber/heating engineer £55-£75/hr, electrician £55-£75/hr, builder £45-£65/hr. Always include separate line items for materials and labour. Be specific about brands/models where appropriate (Worcester Bosch, Vaillant, Drayton, Geberit, etc). Keep titles concise (under 80 chars). Return between 2 and 8 line items.

Input may come from voice transcripts recorded on a noisy job site, in a van, or while driving. Expect filler words, false starts, traffic noise, radio chatter, power tools, and unrelated background conversation. Ignore anything that isn't clearly part of the job description and focus only on trade-relevant materials, labour and scope.

PRICING RULES — VERY IMPORTANT:

When the tradesperson mentions specific prices in their voice note, use those exact prices in the quote. Do not override or suggest alternative prices when the tradesperson has stated their own.

Examples of price patterns to detect:
- "Worcester Bosch for £1,200"
- "6 hours labour at £65 an hour"
- "Magnetic filter £85"
- "Charging £450 for the power flush"
- "Three radiators at £150 each"

If the tradesperson speaks a price, use it. If they describe an item without a price, use current UK trade pricing estimates.

SOURCE FIELD — STRICT RULES (READ CAREFULLY):

Each line item MUST have a source field. Use these rules in this exact order — do not deviate:

Rule 1: If the tradesperson explicitly stated a price for this specific item in their voice note (using phrases like '£X', 'X pounds', 'at X an hour', 'charging X'), set source = 'voice'.

Rule 2: If a LEARNED PATTERNS section was provided below AND that section contains a clear match for this item, set source = 'learned'. If no LEARNED PATTERNS section exists or it's empty, you must NOT use 'learned' for any item.

Rule 3: For all other items where you estimated the price using general UK trade knowledge, set source = 'ai'. This is the most common case for new users.

CATEGORY FIELD — REQUIRED ON EVERY LINE ITEM:

Each line item MUST have a category field. Use these rules:
- 'labour' — time-based work: installation, fitting, commissioning, hourly rate work, any work the tradesperson performs themselves
- 'materials' — physical products being supplied: boilers, radiators, fittings, parts, units, valves, pipes
- 'certificate' — gas safety certificates, electrical certificates (EICR), boiler commissioning certificates, building regs notifications
- 'cis_labour' — only use when CIS mode is enabled on the customer. Labour income that falls under CIS deduction
- 'other' — anything that does not fit the above categories

UNIT FIELD — REQUIRED ON EVERY LINE ITEM:

Each line item MUST have a unit field. Use these rules:
- For 'labour' or 'cis_labour' lines: estimate realistic UK trade duration. Use 'hours' when the work takes less than a full day, 'days' for multi-day jobs. Set qty to the estimated duration (hours rounded to 0.5, days rounded to 0.5). unit_price is then the hourly or daily rate.
- For all other categories: use 'qty'. qty is the count of items supplied.

Examples:
- Boiler install labour, 1 day on site → { qty: 1, unit_price: 480, unit: "days", category: "labour" }
- Tap change, ~1.5 hours → { qty: 1.5, unit_price: 65, unit: "hours", category: "labour" }
- 3 radiators → { qty: 3, unit_price: 150, unit: "qty", category: "materials" }

JOB DESCRIPTION — write a clean, concise, professional summary of the work for the customer-facing quote. Extract only the scope of work from what the tradesperson said. Do NOT include:
- Customer names, phone numbers, or email addresses
- Conversational filler ('thank you', 'I need', 'can you', 'so basically', 'right then')
- Asides about the customer, pricing, timing or scheduling

Write it as a professional job description a customer would expect on a formal quote. For example, if the tradesperson says "I need four radiators fitted for Mr Dave Smith, his number's 07886293616, email at hotmail, thanks", the clean_description should simply be: "Supply and fit 4 radiators including connecting pipework, filling, bleeding and balancing."

EXTRACTED CUSTOMER DETAILS — if the tradesperson mentioned a customer name, phone number, or email address in the voice note, return them in the extracted_customer object. Omit any field that wasn't mentioned. Do NOT make up details. These will be captured into the customer record separately from the job description.`;

export const generateAIQuote = createServerFn({ method: "POST" })
  .middleware([requireActiveSubscription])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }): Promise<AIGeneratedQuote> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const { supabase, userId } = context as { supabase: any; userId: string };
    const allPatterns = await fetchTopPatterns(supabase, userId, 80);
    const patterns = rankPatternsForJob(allPatterns, `${data.trade} ${data.description}`, 30);
    const systemPrompt = SYSTEM_PROMPT + tradeGuidance(data.trade) + patternsForPrompt(patterns);


    const userPrompt = `Generate an itemised quote for this job.

Trade: ${data.trade}
VAT registered: ${data.vatRegistered ? "Yes (20% VAT will be added)" : "No"}

Job description:
${data.description}

Return ONLY valid JSON matching this exact shape (no markdown, no commentary):
{
  "title": "Concise quote title",
  "line_items": [
    { "description": "Item or labour description", "qty": 1, "unit_price": 0, "source": "voice" | "learned" | "ai", "category": "labour" | "materials" | "certificate" | "cis_labour" | "other", "unit": "qty" | "hours" | "days" }
  ]
}

Unit prices must be ex-VAT in GBP. Quantities can be decimal (e.g. 1.5 for 1.5 hours). Every line item MUST include source, category and unit. Labour lines should use "hours" or "days" with the price as the hourly/daily rate.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("Anthropic API error", res.status, txt);
      if (res.status === 429) throw new Error("Rate limited. Try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Settings.");
      throw new Error("Could not generate quote. Please try again.");
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
