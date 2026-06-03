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
  // Optional context for live phrase-by-phrase capture so the AI can decide
  // whether this new chunk CONTINUES the previous in-progress item (slow
  // speaker pausing mid-thought) or starts NEW item(s) (moved on to next job).
  previousChunkText: z.string().max(4000).optional(),
  previousItemDescription: z.string().max(240).optional(),
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
  // When previous-item context is provided and this new chunk continues the
  // SAME item the speaker was already describing, set true and return a SINGLE
  // line_items entry representing the merged/extended item (which replaces the
  // previous in-progress line). When false (default), line_items are appended
  // as new items.
  continues_previous: z.boolean().optional().default(false),
  line_items: z.array(LineItemSchema).min(1).max(20),
});

export type AIGeneratedQuote = z.infer<typeof QuoteSchema>;

function labourRatesBlock(hourly: number | null, day: number | null): string {
  const h = hourly && hourly > 0 ? hourly : null;
  const d = day && day > 0 ? day : null;
  if (!h && !d) {
    return `\n\nLABOUR RATES — NOT CONFIGURED:\nThe tradesperson has NOT set their labour rates in settings. If they speak a labour price (e.g. "£65 an hour", "£280 a day"), use that exact figure with source: "voice". If they mention labour without any price, still include the labour line but set unit_price to 0 so they can fill it in — do NOT invent a market rate.`;
  }
  return `\n\nLABOUR RATES — USE THESE EXACT FIGURES (configured by the tradesperson, do NOT override):
${h ? `- Hourly rate: £${h}/hr (use for "hours" labour lines)` : "- Hourly rate: not set — if labour is in hours and no rate is spoken, set unit_price to 0"}
${d ? `- Day rate: £${d}/day (use for "days" labour lines)` : "- Day rate: not set — if labour is in days and no rate is spoken, set unit_price to 0"}
- "two days labour" → qty 2, unit "days", unit_price ${d ?? 0}.
- "three hours" → qty 3, unit "hours", unit_price ${h ?? 0}.
- The ONLY time you may use a different labour figure is when the tradesperson explicitly speaks a price for that labour line in this voice note (then use it and mark source: "voice"). Never invent or "estimate" a labour rate from market knowledge when these settings are configured.`;
}

const SYSTEM_PROMPT = `You are an expert UK tradesperson estimator generating itemised quotes for small trade businesses in 2026. Use realistic current UK market prices (GBP, ex-VAT) for parts and materials. Be specific about brands/models where appropriate (Worcester Bosch, Vaillant, Drayton, Geberit, etc). Keep titles concise (under 80 chars).

Input may come from voice transcripts recorded on a noisy job site, in a van, or while driving. Expect filler words, false starts, traffic noise, radio chatter, power tools, and unrelated background conversation. Ignore anything that isn't clearly part of the job description and focus only on trade-relevant materials, labour and scope.

ONLY-WHAT-WAS-SAID RULE — STRICTEST RULE, OVERRIDES EVERYTHING ELSE:

Create line items ONLY for things the tradesperson actually mentioned in the voice note. Do NOT invent, assume, pad or "round out" the quote.

- If the job is described as labour-only, the quote MUST be labour-only — do NOT add assumed materials, fixings, sundries, consumables, disposal, "while we're there" extras, certificates, or anything else that wasn't spoken.
- Do NOT add typical/standard materials that "usually go with" the spoken work. If they didn't say it, it's not in the quote.
- Do NOT add a labour line if no labour was mentioned, and do NOT add a materials line if no materials were mentioned.
- Number of line items is driven entirely by what was said. A quote with a single line item is fine. There is no minimum.
- If a MATERIAL was mentioned but NO price was given for it, include it as a line item, set source: "ai", and append " — estimate, please confirm" to the description so the tradesperson can review. Do NOT silently fabricate a confident price.
- Never include an item just to make the quote look more thorough.

PRICING RULES — VERY IMPORTANT:

When the tradesperson mentions specific prices in their voice note, use those exact prices in the quote. Do not override or suggest alternative prices when the tradesperson has stated their own.

Examples of price patterns to detect:
- "Worcester Bosch for £1,200"
- "6 hours labour at £65 an hour"
- "Magnetic filter £85"
- "Charging £450 for the power flush"
- "Three radiators at £150 each"

If the tradesperson speaks a price, use it. If they describe a material without a price, estimate using current UK trade pricing and flag it as " — estimate, please confirm".

SOURCE FIELD — STRICT RULES (READ CAREFULLY):

Each line item MUST have a source field. Use these rules in this exact order — do not deviate:

Rule 1: If the tradesperson explicitly stated a price for this specific item in their voice note (using phrases like '£X', 'X pounds', 'at X an hour', 'charging X'), set source = 'voice'.

Rule 2: If a LEARNED PATTERNS section was provided below AND that section contains a clear match for this item, set source = 'learned'. If no LEARNED PATTERNS section exists or it's empty, you must NOT use 'learned' for any item.

Rule 3: For all other items where you estimated the price using general UK trade knowledge, set source = 'ai'. This is the most common case for new users.

Labour lines priced from the tradesperson's configured rates (see LABOUR RATES block) use source = 'learned' (the rate came from their own settings, not from voice or from market guessing).

CATEGORY FIELD — REQUIRED ON EVERY LINE ITEM:

Each line item MUST have a category field. Use these rules:
- 'labour' — time-based work: installation, fitting, commissioning, hourly rate work, any work the tradesperson performs themselves
- 'materials' — physical products being supplied: boilers, radiators, fittings, parts, units, valves, pipes
- 'certificate' — gas safety certificates, electrical certificates (EICR), boiler commissioning certificates, building regs notifications
- 'cis_labour' — only use when CIS mode is enabled on the customer. Labour income that falls under CIS deduction
- 'other' — anything that does not fit the above categories

UNIT FIELD — REQUIRED ON EVERY LINE ITEM:

Each line item MUST have a unit field. Use these rules:
- For 'labour' or 'cis_labour' lines: use the unit the tradesperson spoke. "X hours" → unit "hours", qty = X (rounded to 0.5). "X days" → unit "days", qty = X (rounded to 0.5). If labour is mentioned without a clear duration, pick the most sensible unit from what was said (e.g. "a full day" → 1 day; "a couple of hours" → 2 hours) — do not invent durations that weren't implied.
- For all other categories: use 'qty'. qty is the count of items supplied.

Examples:
- "Two days labour on site" → { qty: 2, unit_price: <day rate from settings>, unit: "days", category: "labour", source: "learned" }
- "Three hours work" → { qty: 3, unit_price: <hourly rate from settings>, unit: "hours", category: "labour", source: "learned" }
- "Three radiators" (no price spoken) → { qty: 3, unit_price: <estimate>, unit: "qty", category: "materials", source: "ai", description: "Radiator — estimate, please confirm" }

JOB DESCRIPTION — write a clean, concise, professional summary of the work for the customer-facing quote. Extract only the scope of work from what the tradesperson said. Do NOT include:
- Customer names, phone numbers, or email addresses
- Conversational filler ('thank you', 'I need', 'can you', 'so basically', 'right then')
- Asides about the customer, pricing, timing or scheduling

Write it as a professional job description a customer would expect on a formal quote.

EXTRACTED CUSTOMER DETAILS — if the tradesperson mentioned a customer name, phone number, or email address in the voice note, return them in the extracted_customer object. Omit any field that wasn't mentioned. Do NOT make up details.

ITEM BOUNDARY DETECTION (LIVE PHRASE CAPTURE) — VERY IMPORTANT:

When a "PREVIOUS IN-PROGRESS ITEM" block is included below, the tradesperson is describing a job live, phrase by phrase, with natural pauses. Your job is to decide — from the MEANING of the new chunk, not from any timer — whether this new chunk:

(a) CONTINUES the same item the speaker was already describing (they paused to think, took a breath, said "erm…", added more detail to the SAME task/object), OR
(b) STARTS one or more NEW items (they have moved on to a different task/object/room/material).

Heuristics:
- Same task/object/material being elaborated on, qualified, given a price, given a quantity, or refined → CONTINUATION. Example: previous "replace radiator in living room", new chunk "the big double panel one, about 1200 wide" → continuation.
- A new verb/task on a different object, a new room, a new material category, or an obvious topic shift → NEW item(s). Example: previous "replace radiator in living room", new chunk "and then fit a new toilet seat" → new item.
- Filler/connector words at the start ("and", "also", "then", "next", "after that", "oh and") usually signal a NEW item, but only when followed by a different task/object. "And it needs bleeding too" after a radiator line is still about that radiator.
- A bare price or quantity on its own ("…about three hundred quid", "…times two") is a CONTINUATION applying to the previous item.
- If the new chunk clearly contains MULTIPLE distinct items, return them all in line_items with continues_previous: false (the first item is a NEW item, not a merge).

When continues_previous is true:
- line_items MUST contain exactly ONE entry representing the FULL merged item (previous text + new text combined), re-priced and re-described as a single clean professional line. This replaces the previous in-progress line on the client.
- Apply all the usual rules (filler stripping, only-what-was-said, labour from settings) to the COMBINED text.

When continues_previous is false:
- line_items are the NEW items only — do NOT re-emit the previous item.
- The previous item is already committed and will not be changed.

If NO "PREVIOUS IN-PROGRESS ITEM" block is included, treat the input as a fresh chunk: continues_previous must be false and line_items are the items from this chunk.

Default continues_previous to FALSE when uncertain — splitting a continuation into two lines is a smaller mistake than merging two genuinely different items into one.`;

export const generateAIQuote = createServerFn({ method: "POST" })
  .middleware([requireActiveSubscription])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }): Promise<AIGeneratedQuote> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const { supabase, userId } = context as { supabase: any; userId: string };
    const allPatterns = await fetchTopPatterns(supabase, userId, 80);
    const patterns = rankPatternsForJob(allPatterns, `${data.trade} ${data.description}`, 30);
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("labour_hourly_rate, labour_day_rate")
      .eq("id", userId)
      .maybeSingle();
    const hourly = profileRow?.labour_hourly_rate != null ? Number(profileRow.labour_hourly_rate) : null;
    const day = profileRow?.labour_day_rate != null ? Number(profileRow.labour_day_rate) : null;
    const systemPrompt =
      SYSTEM_PROMPT +
      labourRatesBlock(hourly, day) +
      tradeGuidance(data.trade) +
      patternsForPrompt(patterns);


    const prevBlock =
      data.previousChunkText && data.previousItemDescription
        ? `\n\nPREVIOUS IN-PROGRESS ITEM (currently the last line on the live quote — decide if the new chunk continues this item or starts new ones):\n- Previous spoken text: "${data.previousChunkText}"\n- Previous line description: "${data.previousItemDescription}"\n`
        : "";

    const userPrompt = `Generate an itemised quote for this job.

Trade: ${data.trade}
VAT registered: ${data.vatRegistered ? "Yes (20% VAT will be added)" : "No"}
${prevBlock}
New spoken chunk (job description):
${data.description}

Return ONLY valid JSON matching this exact shape (no markdown, no commentary):
{
  "title": "Concise quote title",
  "clean_description": "Professional scope-of-work summary, no customer names/contacts/filler",
  "extracted_customer": { "name": "optional", "phone": "optional", "email": "optional" },
  "continues_previous": false,
  "line_items": [
    { "description": "Item or labour description", "qty": 1, "unit_price": 0, "source": "voice" | "learned" | "ai", "category": "labour" | "materials" | "certificate" | "cis_labour" | "other", "unit": "qty" | "hours" | "days" }
  ]
}

Omit extracted_customer entirely if no customer details were mentioned. Unit prices must be ex-VAT in GBP. Quantities can be decimal (e.g. 1.5 for 1.5 hours). Every line item MUST include source, category and unit. Labour lines should use "hours" or "days" with the price as the hourly/daily rate.`;

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
