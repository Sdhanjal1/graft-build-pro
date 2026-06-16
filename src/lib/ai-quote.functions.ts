import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveSubscription } from "@/lib/require-active-subscription";
import { fetchTopPatterns, patternsForPrompt } from "@/lib/pricing-patterns.functions";
import { tradeGuidance } from "@/lib/ai-trade-guidance";
import { rankPatternsForJob, type PricingPattern } from "@/lib/pricing-patterns";


const InputSchema = z.object({
  description: z.string().min(1).max(4000),
  trade: z.string().min(1).max(120),
  vatRegistered: z.boolean(),
});

const LineItemSchema = z.object({
  description: z.string().min(1).max(240),
  // Accept any number here; we filter qty <= 0 / missing defensively before
  // schema parse so one bad line doesn't fail the whole quote.
  qty: z.number().positive().max(1000),
  unit_price: z.number().nonnegative().max(100000),
  source: z.enum(["voice", "learned", "ai"]).optional().default("ai"),
  category: z.enum(["labour", "materials", "certificate", "cis_labour", "other"]).optional().default("other"),
  unit: z.enum(["qty", "hours", "days"]).optional().default("qty"),
  is_estimate: z.boolean().optional().default(false),
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
  line_items: z.array(LineItemSchema).min(1).max(30),
});

export type AIGeneratedQuote = z.infer<typeof QuoteSchema>;

function labourRatesBlock(hourly: number | null, day: number | null): string {
  const h = hourly && hourly > 0 ? hourly : null;
  const d = day && day > 0 ? day : null;
  if (!h && !d) {
    return `\n\nLABOUR RATES — NOT CONFIGURED:\nThe tradesperson has NOT set their labour rates in settings. If they speak a labour price (e.g. "£65 an hour", "£280 a day"), use that exact figure with source: "voice". If they mention labour without any price, still include the labour line but set unit_price to 0 so they can fill it in — do NOT invent a market rate. For service-type jobs (boiler service, gas safety check, EICR, callout, annual service) where no price was spoken, set qty: 1, unit: "qty", unit_price: 0 (NEVER 0 qty).`;
  }
  return `\n\nLABOUR RATES — USE THESE EXACT FIGURES (configured by the tradesperson, do NOT override):
${h ? `- Hourly rate: £${h}/hr (use for "hours" labour lines)` : "- Hourly rate: not set — if labour is in hours and no rate is spoken, set unit_price to 0"}
${d ? `- Day rate: £${d}/day (use for "days" labour lines)` : "- Day rate: not set — if labour is in days and no rate is spoken, set unit_price to 0"}
- "two days labour" → qty 2, unit "days", unit_price ${d ?? 0}.
- "three hours" → qty 3, unit "hours", unit_price ${h ?? 0}.
- SERVICE-TYPE JOBS (boiler service, gas safety check / CP12, EICR, PAT test, callout, annual service, inspection): these aren't billed per unit. Use qty: 1, unit: "qty", and put the FULL price in unit_price. If the tradesperson spoke a price, use that. Otherwise estimate a sensible job total based on the configured rate${h ? ` (e.g. ~1.5–2 hours at £${h}/hr for an annual boiler service)` : d ? ` (e.g. a portion of the £${d}/day rate)` : ""}, set source: "ai", is_estimate: true. NEVER emit qty: 0.
- The ONLY time you may use a different labour figure is when the tradesperson explicitly speaks a price for that labour line in this voice note (then use it and mark source: "voice"). Never invent or "estimate" a labour rate from market knowledge when these settings are configured.`;
}

const SYSTEM_PROMPT = `You are an expert UK tradesperson estimator generating itemised quotes for small trade businesses in 2026. Use realistic current UK market prices (GBP, ex-VAT) for parts and materials. Be specific about brands/models where appropriate (Worcester Bosch, Vaillant, Drayton, Geberit, etc).

PRICING POLICY: When the LEARNED PATTERNS block below contains a match for a spoken item, use that price verbatim and set source: "learned". Otherwise estimate from UK 2026 market knowledge with source: "ai". Never invent labour rates when settings provide them.

Input may come from voice transcripts recorded on a noisy job site, in a van, or while driving. Expect filler words, false starts, traffic noise, radio chatter, power tools, and unrelated background conversation. Ignore anything that isn't clearly part of the job description and focus only on trade-relevant materials, labour and scope.

DESCRIPTIONS — CUSTOMER-FACING, PROFESSIONAL ONLY:

Every description appears verbatim on the customer's invoice. Descriptions MUST be clean, professional item names — NEVER transcribed speech or filler.

WRONG (transcript-like) → CORRECT (professional):
- "fit two radiators and the heating" → "Supply and fit 2 radiators"
- "service the boiler like annual sort of thing" → "Annual boiler service"
- "magnetic filter thing on the return pipe" → "Magnetic system filter"
- "rip out the old suite and fit new" → "Strip out existing bathroom suite; supply and fit new"
- "bit of labour to fit the tap" → "Labour — fit kitchen tap"
- "couple hours work" → DO NOT USE. Only describe the actual work (e.g. "Labour — fit radiators"), not the time spent.

Rules:
- Sentence case, no trailing punctuation.
- Professional trade terminology only (no "gonna", "bit of", "sort of", "thing").
- No first-person ("I'll", "we're") or filler ("like", "basically", "you know").
- 2–8 words typical, up to 12 with a meaningful location/spec.
- NO internal notes, estimates disclaimers, or qualifiers in the text.
- If it's an estimate, set is_estimate: true on the line item — do NOT add "— estimate" to the description text.
- NO: "Estimate — Boiler service (please confirm price)". YES: "Annual boiler service" (with is_estimate: true).

Translate the tradesperson's speech into the professional description they would write on their own quote.

CUSTOMER-FACING OUTPUT — CRITICAL:
Everything you return appears verbatim on the customer's quote and invoice. It must read like a clean, professional document — not a transcript.

LINE ITEM DESCRIPTIONS — STRICT RULES:
- Each description is a concise, professional item name a customer would expect to see on a formal quote. Sentence case, no trailing punctuation, no first-person ("I'll", "we're gonna"), no filler, no asides.
- Translate spoken phrasing into proper trade terminology. Examples:
  - "do a service on the boiler" → "Boiler service"
  - "rip out and chuck the old bathroom suite" → "Strip out existing bathroom suite"
  - "fit one of them big double rads in the front room" → "Supply and fit double-panel radiator (living room)"
  - "magnetic filter on the return" → "Magnetic system filter"
- Keep descriptions SHORT and CLEAR (typically 2–8 words; up to ~12 when a meaningful location/spec helps the customer).
- NEVER include words like "estimate", "please confirm", "TBC", "subject to", "rough", "approx", "guess", or any internal note inside the description text. The description is what the customer reads.
- If the price is your AI estimate (not spoken, not from learned patterns), set is_estimate: true on the line. Do NOT put "— estimate, please confirm" or any similar phrase into the description. The UI shows a separate "Estimate" tag.

LABOUR — SINGLE COMBINED LINE:
- Output exactly ONE labour line for the entire quote, covering all the work the tradesperson described. Do NOT create a separate labour line per task.
- Sum all the labour time across every task into that single line. E.g. fitting 2 radiators (2hr) + 2 taps (2hr) + a toilet (1hr) = ONE line "Labour" with qty 5, unit "hours", priced at the hourly rate.
- Write the description as a clear summary of the labour performed, e.g. "Labour — fit radiators, taps & toilet" or simply "Labour" if there are many tasks. Keep it clean and customer-facing.
- If the tradesperson spoke specific labour prices for different tasks, sum them into the one line's total (use unit "qty", qty 1, unit_price = the combined labour cost).
- Use the configured hourly/day rate for the combined time exactly as per the LABOUR RATES rules — never invent a rate.
- This applies ONLY to labour. Materials stay itemised: combine identical materials into one line with summed quantity (e.g. "Radiator (double-panel)" qty 3), but keep genuinely different materials as separate lines.

QUOTE TITLE — STRICTEST RULE, NON-NEGOTIABLE:

Title MUST summarise ALL pieces of work mentioned in a single 3–4 word phrase. NEVER show only one item when multiple were spoken.
- If ANY multiple items are spoken (radiators AND toilet seat, boiler AND thermostat, etc.), the title MUST include both.
- Collapse into short, punchy trade terms joined with "&".
- Sentence case, no trailing punctuation, exactly 3–4 words, NEVER longer.
- NEVER copy the raw transcript, customer names, or filler. NEVER include "estimate" or qualifiers.

REQUIRED EXAMPLES (follow exactly):
- User said: "fit two radiators, bleed the system, and replace a toilet seat"
  → MUST return: "Radiators & toilet fit" (4 words, includes both main items)
- User said: "service the boiler and fit a new thermostat"
  → MUST return: "Boiler & thermostat" (3 words, both items)
- User said: "just new taps in the kitchen"
  → MUST return: "Kitchen tap fit" (3 words)
- User said: "replace consumer unit and install EV charger"
  → MUST return: "Consumer unit & EV" (4 words, both items)

WRONG (do not do this):
- "Radiator" ❌ (only 1 word, ignores toilet seat)
- "Radiators, toilet, bleed" ❌ (5 words, too long)
- "Radiator installation & fit toilet seat & bleed system" ❌ (way too long, not condensed)

YOUR JOB: read all the work mentioned, condense to the 2–3 KEY items max, phrase in 3–4 words.

ONLY-WHAT-WAS-SAID RULE — STRICTEST RULE, OVERRIDES EVERYTHING ELSE:

Create line items ONLY for things the tradesperson actually mentioned in the voice note. Do NOT invent, assume, pad or "round out" the quote.

- If the job is described as labour-only, the quote MUST be labour-only — do NOT add assumed materials, fixings, sundries, consumables, disposal, "while we're there" extras, certificates, or anything else that wasn't spoken.
- Do NOT add typical/standard materials that "usually go with" the spoken work. If they didn't say it, it's not in the quote.
- Do NOT add a labour line if no labour was mentioned, and do NOT add a materials line if no materials were mentioned.
- Number of line items is driven entirely by what was said. A quote with a single line item is fine. There is no minimum.
- If a MATERIAL was mentioned but NO price was given for it, include it as a line item with source: "ai" AND is_estimate: true. The description stays clean (just the item name). Do NOT silently fabricate a confident price.
- Never include an item just to make the quote look more thorough.

PRICING RULES — VERY IMPORTANT:

When the tradesperson mentions specific prices in their voice note, use those exact prices in the quote. Do not override or suggest alternative prices when the tradesperson has stated their own.

Examples of price patterns to detect:
- "Worcester Bosch for £1,200"
- "6 hours labour at £65 an hour"
- "Magnetic filter £85"
- "Charging £450 for the power flush"
- "Three radiators at £150 each"

If the tradesperson speaks a price, use it (source: "voice", is_estimate: false). If they describe a material without a price, estimate using current UK trade pricing and set is_estimate: true.

SOURCE FIELD — STRICT RULES (READ CAREFULLY):

Each line item MUST have a source field. Use these rules in this exact order — do not deviate:

Rule 1: If the tradesperson explicitly stated a price for this specific item in their voice note (using phrases like '£X', 'X pounds', 'at X an hour', 'charging X'), set source = 'voice' and is_estimate = false.

Rule 2: If a LEARNED PATTERNS section was provided below AND that section contains a clear match for this item, set source = 'learned' and is_estimate = false. If no LEARNED PATTERNS section exists or it's empty, you must NOT use 'learned' for any item.

Rule 3: For all other items where you estimated the price using general UK trade knowledge, set source = 'ai' and is_estimate = true.

Labour lines priced from the tradesperson's configured rates (see LABOUR RATES block) use source = 'learned' and is_estimate = false (the rate came from their own settings, not from voice or from market guessing).

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
- "Two days labour on site" → { description: "On-site labour", qty: 2, unit_price: <day rate>, unit: "days", category: "labour", source: "learned", is_estimate: false }
- "Three hours work" → { description: "Labour", qty: 3, unit_price: <hourly rate>, unit: "hours", category: "labour", source: "learned", is_estimate: false }
- "Three radiators" (no price spoken) → { description: "Radiator", qty: 3, unit_price: <estimate>, unit: "qty", category: "materials", source: "ai", is_estimate: true }
- "Annual boiler service" → { description: "Annual boiler service", qty: 1, unit_price: <job total>, unit: "qty", category: "labour", source: "ai", is_estimate: true }

QTY FIELD — STRICT, NON-NEGOTIABLE:
Every line item MUST have qty >= 1. NEVER emit qty: 0, negative, or missing. For service-type / fixed-fee work (boiler service, gas safety / CP12, EICR, PAT test, callout, inspection) where quantity isn't a unit count, use qty: 1 and put the full price in unit_price. If unsure, default qty to 1.

JOB DESCRIPTION — write a clean, concise, professional summary of the work for the customer-facing quote. Extract only the scope of work from what the tradesperson said. Do NOT include:
- Customer names, phone numbers, or email addresses
- Conversational filler ('thank you', 'I need', 'can you', 'so basically', 'right then')
- Asides about the customer, pricing, timing or scheduling

Write it as a professional job description a customer would expect on a formal quote.

EXTRACTED CUSTOMER DETAILS — if the tradesperson mentioned a customer name, phone number, or email address in the voice note, return them in the extracted_customer object. Omit any field that wasn't mentioned. Do NOT make up details.

EXTRACTED CUSTOMER DETAILS — if the tradesperson mentioned a customer name, phone number, or email address in the voice note, return them in the extracted_customer object. Omit any field that wasn't mentioned. Do NOT make up details.`;

export const generateAIQuote = createServerFn({ method: "POST" })
  .middleware([requireActiveSubscription])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }): Promise<AIGeneratedQuote> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const { supabase, userId } = context as { supabase: any; userId: string };
    const allPatterns: PricingPattern[] = await fetchTopPatterns(supabase, userId, 80);
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("labour_hourly_rate, labour_day_rate")
      .eq("id", userId)
      .maybeSingle();
    const hourly: number | null = profileRow?.labour_hourly_rate != null ? Number(profileRow.labour_hourly_rate) : null;
    const day: number | null = profileRow?.labour_day_rate != null ? Number(profileRow.labour_day_rate) : null;
    const patterns = rankPatternsForJob(allPatterns, `${data.trade} ${data.description}`, 10);
    const systemPrompt =
      SYSTEM_PROMPT +
      labourRatesBlock(hourly, day) +
      tradeGuidance(data.trade) +
      patternsForPrompt(patterns, data.trade);

    const userPrompt = `CRITICAL: Create line items ONLY for work explicitly mentioned in the job description below. Do NOT add suggested items, related services, or items from the learned patterns unless the tradesperson specifically mentioned them. The job description is the source of truth.

Generate an itemised quote for this job.

Trade: ${data.trade}
VAT registered: ${data.vatRegistered ? "Yes (20% VAT will be added)" : "No"}

Job description:
${data.description}

Return ONLY valid JSON matching this exact shape (no markdown, no commentary):
{
  "title": "3–4 words max, covers all work (e.g. 'Boiler & radiators fit')",
  "clean_description": "Professional scope-of-work summary, no customer names/contacts/filler",
  "extracted_customer": { "name": "optional", "phone": "optional", "email": "optional" },
  "line_items": [
    { "description": "Clean professional item name only (NO 'estimate' / 'please confirm' text)", "qty": 1, "unit_price": 0, "source": "voice" | "learned" | "ai", "category": "labour" | "materials" | "certificate" | "cis_labour" | "other", "unit": "qty" | "hours" | "days", "is_estimate": false }
  ]
}

Omit extracted_customer entirely if no customer details were mentioned. Unit prices must be ex-VAT in GBP. Quantities can be decimal (e.g. 1.5 for 1.5 hours). Every line item MUST include source, category, unit and is_estimate. Labour lines should use "hours" or "days" with the price as the hourly/daily rate. Title must be a clean job summary, NOT the raw transcript. Descriptions must be clean item names — never contain "estimate" or "please confirm" text.`;

    let res: Response;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
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
      const txt = await res.text();
      console.error("Anthropic API error", res.status, txt);
      if (res.status === 429) throw new Error("Rate limited. Try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Settings.");
      throw new Error("Could not generate quote. Please try again.");
    }

    const payload = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
      stop_reason?: string;
    };
    if (payload.stop_reason === "max_tokens") {
      console.warn("[ai-quote] response truncated — consider raising max_tokens");
    }
    const text = payload.content?.find((c) => c.type === "text")?.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Claude returned no JSON");

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error("Claude returned malformed JSON");
    }
    // Defensive: drop line items with missing/zero/negative qty BEFORE schema
    // parse, so one bad line doesn't fail the whole regenerate pass.
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as any).line_items)) {
      const raw = (parsed as any).line_items as Array<any>;
      const before = raw.length;
      (parsed as any).line_items = raw.filter((li) => {
        const q = typeof li?.qty === "number" ? li.qty : Number(li?.qty);
        return Number.isFinite(q) && q > 0;
      });
      const dropped = before - (parsed as any).line_items.length;
      if (dropped > 0) console.warn(`[ai-quote] dropped ${dropped} line item(s) with invalid qty`);
      if ((parsed as any).line_items.length === 0) {
        throw new Error("Could not generate quote. Please try again.");
      }
    }
    const result = QuoteSchema.parse(parsed);
    // Safety net: strip any "— estimate, please confirm" suffix the model may have
    // emitted into a description and convert it into the structured is_estimate flag,
    // so the customer-facing description text is always clean.
    const ESTIMATE_SUFFIX_RE = /\s*[—\-–]\s*estimate,?\s*please confirm\.?\s*$/i;
    result.line_items = result.line_items.map((li) => {
      const hadSuffix = ESTIMATE_SUFFIX_RE.test(li.description);
      const cleanedDesc = li.description.replace(ESTIMATE_SUFFIX_RE, "").trim();
      return {
        ...li,
        description: cleanedDesc || li.description,
        is_estimate: !!li.is_estimate || hadSuffix,
      };
    });
    // Title safety: strip stray trailing " — estimate" and trim.
    result.title = result.title.replace(/\s*[—\-–]\s*estimate.*$/i, "").trim();
    // Enforce 4-word max on the title. Strip trailing punctuation/conjunctions
    // so we don't leave "Boiler &" or "Radiators," dangling after truncation.
    {
      const cleaned = result.title
        .replace(/[.,;:!?]+$/g, "")
        .replace(/\s+/g, " ")
        .trim();
      const words = cleaned.split(" ").filter(Boolean);
      if (words.length > 4) {
        let truncated = words.slice(0, 4).join(" ");
        truncated = truncated.replace(/\s*(?:&|and|\+|,|;|:|-|—|–)\s*$/i, "").trim();
        result.title = truncated;
      } else {
        result.title = cleaned;
      }
    }

    return result;
  });

