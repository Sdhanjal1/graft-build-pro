import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveSubscription } from "@/lib/require-active-subscription";
import { fetchTopPatterns, patternsForPrompt } from "@/lib/pricing-patterns.functions";
import { tradeGuidance } from "@/lib/ai-trade-guidance";
import { rankPatternsForJob } from "@/lib/pricing-patterns";


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

export type AICaptureQuote = z.infer<typeof QuoteSchema>;

function labourRatesBlock(hourly: number | null, day: number | null): string {
  const h = hourly && hourly > 0 ? hourly : null;
  const d = day && day > 0 ? day : null;
  if (!h && !d) {
    return `\n\nLABOUR RATES — NOT CONFIGURED:\nThe tradesperson has NOT set their labour rates in settings. If they speak a labour price, use that exact figure with source: "voice". If they mention labour without any price, still include the labour line but set unit_price to 0 — do NOT invent a market rate.`;
  }
  return `\n\nLABOUR RATES — USE THESE EXACT FIGURES (configured by the tradesperson, do NOT override):
${h ? `- Hourly rate: £${h}/hr (use for "hours" labour lines)` : "- Hourly rate: not set"}
${d ? `- Day rate: £${d}/day (use for "days" labour lines)` : "- Day rate: not set"}
- "two days labour" → qty 2, unit "days", unit_price ${d ?? 0}.
- "three hours" → qty 3, unit "hours", unit_price ${h ?? 0}.
- The ONLY time you may use a different labour figure is when the tradesperson explicitly speaks a price for that labour line (then use it and mark source: "voice"). Never invent or "estimate" a labour rate from market knowledge when these settings are configured.`;
}

const SYSTEM_PROMPT = `You are an expert UK tradesperson estimator generating itemised quotes for small trade businesses in 2026. Use realistic current UK market prices (GBP, ex-VAT) for parts and materials. Be specific about brands/models where appropriate (Worcester Bosch, Vaillant, Drayton, Geberit, etc). Inputs may come from voice transcripts recorded on noisy job sites, ignore filler words, traffic noise, radio chatter and unrelated background talk; focus only on trade-relevant scope.

The following items were captured individually on site by a tradesperson walking through a property. Treat them as a complete job list and generate a professional itemised quote. Each captured item should become one or more line items in the quote.

CUSTOMER-FACING OUTPUT — CRITICAL:
Everything you return appears verbatim on the customer's quote and invoice. It must read like a clean, professional document — not a transcript.

LINE ITEM DESCRIPTIONS — STRICT RULES:
- Each description is a concise, professional item name a customer would expect on a formal quote. Sentence case, no trailing punctuation, no first-person, no filler, no asides.
- Translate spoken phrasing into proper trade terminology. Examples: "do a service on the boiler" → "Boiler service"; "rip out the old bathroom suite" → "Strip out existing bathroom suite"; "fit a big double rad in the front room" → "Supply and fit double-panel radiator (living room)".
- Keep descriptions SHORT and CLEAR (typically 2–8 words; up to ~12 when a meaningful location/spec helps).
- NEVER include words like "estimate", "please confirm", "TBC", "subject to", "rough", "approx", "guess", or any internal note in the description text. The description is what the customer reads.
- If the price is your AI estimate, set is_estimate: true on the line. Do NOT add "— estimate, please confirm" or any qualifier inside the description. The UI shows a separate "Estimate" tag.

QUOTE TITLE — STRICT RULES:
- Title is a single short, professional summary of the WHOLE job — what a customer would expect at the top of a quote/invoice. Sentence case, no trailing punctuation, under 80 chars.
- Summarise the main pieces of work, joined with commas and a final "&". Examples: "Boiler service, radiator install & kitchen tap fit"; "Full bathroom refurb & en-suite first fix"; "Replace consumer unit & install EV charger".
- NEVER copy raw transcript, customer names, addresses, fillers, or chit-chat. NEVER end with "— estimate" or similar qualifiers.

DISFLUENCY / FILLER STRIPPING — APPLY BEFORE INTERPRETING:

The transcript comes from live voice on a job site and will contain filler words, false starts, repeated words and thinking-out-loud padding. You MUST strip these and interpret the tradesperson's MEANING into clean, professional quote language. Do NOT transcribe verbatim.

- Remove fillers and disfluencies: "erm", "er", "um", "uh", "ah", "ahh", "hmm", "like", "you know", "I mean", "so", "basically", "right", "okay", "well", "actually", "literally", "sort of", "kind of", "innit", "yeah".
- Remove false starts and self-corrections: keep only the final intended version.
- Collapse stuttered/repeated words.
- Drop conversational scaffolding ("so what we're gonna do is", "let me think", "right then").
- Keep prices and quantities EXACTLY as spoken. Stripping filler must never change a number, unit, or price.
- Stripping filler must never add scope. If removing filler leaves nothing meaningful, do not invent a line item.

ONLY-WHAT-WAS-SAID RULE — STRICTEST RULE, OVERRIDES EVERYTHING ELSE:

Create line items ONLY for things the tradesperson actually captured. Do NOT invent, assume, pad or "round out" the quote.

- If the captured items describe labour-only work, the quote MUST be labour-only — do NOT add assumed materials, fixings, sundries, consumables, disposal, certificates or "while we're there" extras.
- Do NOT add typical/standard materials that "usually go with" the captured work. If they didn't capture it, it's not in the quote.
- Do NOT add a labour line if no labour was captured, and do NOT add a materials line if no materials were captured.
- Number of line items is driven entirely by what was captured. There is no minimum.
- If a MATERIAL was captured but NO price was given, include it as a line item with source: "ai" AND is_estimate: true. Keep the description CLEAN (just the item name) — never put "estimate, please confirm" in the description text.

NEVER-SPLIT-INTO-LABOUR RULE — CRITICAL:

Do NOT automatically split a captured item into a separate material line PLUS a labour line. A single captured phrase becomes a single line unless the tradesperson explicitly said BOTH the material AND labour/time in that phrase.

- "Replace one living room radiator" → ONE line for the radiator. NO labour line.
- "Fit a new boiler" → ONE line for the boiler. NO labour line.
- "Rip out old bathroom" (verb-only, no material) → ONE labour line for the strip-out.
- A labour line is ONLY created when the tradesperson explicitly says labour, time, hours, days, or a pure work action. If labour/time is not spoken, there is NO labour line.

PRICING RULES — VERY IMPORTANT:

When a captured item includes a specific price spoken by the tradesperson, use that exact price and mark source: "voice" (is_estimate: false).
If the tradesperson has previous typical pricing for a similar item (see block below when provided), use that price and mark source: "learned" (is_estimate: false).
Otherwise estimate using current UK trade pricing, mark source: "ai" AND is_estimate: true. Description stays clean.

SOURCE FIELD — REQUIRED ON EVERY LINE ITEM:
- "voice" — price came from the tradesperson's spoken input
- "learned" — price came from their previous pricing patterns OR from their configured labour rates in settings
- "ai" — you estimated using general UK trade pricing knowledge

CATEGORY FIELD — REQUIRED ON EVERY LINE ITEM:
- 'labour' — time-based work: installation, fitting, commissioning, hourly rate work
- 'materials' — physical products supplied: boilers, radiators, fittings, parts, pipes
- 'certificate' — gas safety certs, EICR, building regs notifications, commissioning certs
- 'cis_labour' — only when CIS mode is enabled. Labour income under CIS deduction
- 'other' — anything that does not fit the above

LABOUR PRICING — MUST BE CONSISTENT AND FROM SETTINGS:

Every labour line MUST be priced from the configured LABOUR RATES block above. Never output a guessed flat figure (e.g. "£80 labour") that ignores those rates.

- Duration spoken → use it. "half an hour" → qty 0.5, unit "hours", unit_price = configured hourly rate. "two days" → qty 2, unit "days", unit_price = configured day rate. Total = qty × configured rate. Do NOT invent a different per-hour or per-day figure.
- No duration spoken but labour clearly described (e.g. "strip out old bathroom") → unit "hours" or "days" based on the sensible scale of the job, qty as a sensible whole/half number, unit_price = the configured hourly/daily rate. Mark source: "learned" (rate came from settings).
- A price was explicitly spoken FOR that labour line (e.g. "6 hours at £65") → use the spoken figures verbatim, source: "voice". This is the ONLY exception to using the configured rate.
- If the LABOUR RATES block says rates are NOT configured, set unit_price to 0 on labour lines (per that block) — do NOT substitute a guessed market rate.
- Be consistent across ALL labour lines in the same quote. Never mix a flat "£80" line and a "0.5h × £65" line. Every labour line is qty × configured rate (or qty × spoken rate), never a lump-sum guess.

UNIT FIELD — REQUIRED ON EVERY LINE ITEM:
- For 'labour' or 'cis_labour' lines: see LABOUR PRICING above. "X hours" → unit "hours", qty = X (rounded to 0.5). "X days" → unit "days", qty = X (rounded to 0.5).
- For all other categories: use 'qty'. qty is the count of items supplied.

JOB DESCRIPTION — write a clean, concise, professional summary of all the captured work for the customer-facing quote. Extract only the scope of work. Do NOT include:
- Customer names, phone numbers, or email addresses
- Conversational filler ('thank you', 'I need', 'can you', 'so basically')
- Asides about the customer, pricing, timing or scheduling

Write it as a professional job description a customer would expect on a formal quote.

EXTRACTED CUSTOMER DETAILS — if any captured item mentioned a customer name, phone number, or email address, return them in the extracted_customer object. Omit any field that wasn't mentioned. Do NOT make up details.`;


export const generateCaptureQuote = createServerFn({ method: "POST" })
  .middleware([requireActiveSubscription])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }): Promise<AICaptureQuote> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const { supabase, userId } = context as { supabase: any; userId: string };
    const allPatterns = await fetchTopPatterns(supabase, userId, 80);
    const patterns = rankPatternsForJob(allPatterns, `${data.trade} ${data.items.join(" ")}`, 30);
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
      patternsForPrompt(patterns, data.trade);

    const itemList = data.items.map((d, i) => `${i + 1}. ${d}`).join("\n");

    const userPrompt = `Trade: ${data.trade}
VAT registered: ${data.vatRegistered ? "Yes (20% VAT will be added)" : "No"}
${data.customerName ? `Customer: ${data.customerName}\n` : ""}${data.address ? `Address: ${data.address}\n` : ""}
Items captured on site:
${itemList}

Return ONLY valid JSON matching this exact shape (no markdown, no commentary):
{
  "title": "Concise, professional summary of the whole job (e.g. 'Boiler service, radiator install & kitchen tap fit')",
  "clean_description": "Professional scope-of-work summary, no customer names/contacts/filler",
  "extracted_customer": { "name": "optional", "phone": "optional", "email": "optional" },
  "line_items": [
    { "description": "Clean professional item name only (NO 'estimate' / 'please confirm' text)", "qty": 1, "unit_price": 0, "source": "voice" | "learned" | "ai", "category": "labour" | "materials" | "certificate" | "cis_labour" | "other", "unit": "qty" | "hours" | "days", "is_estimate": false }
  ]
}

Omit extracted_customer entirely if no customer details were mentioned. Unit prices must be ex-VAT in GBP. Quantities can be decimal. Every line item MUST include source, category, unit and is_estimate. Labour lines should use "hours" or "days" with the price as the hourly/daily rate. Title must be a clean job summary, NOT raw transcript. Descriptions must be clean item names — never contain "estimate" or "please confirm".`;


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
          model: "claude-sonnet-4-6",
          max_tokens: 3072,
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
    // `max_tokens` is set generously (3072) but a complex job list can still
    // be truncated. When that happens Claude returns `stop_reason: "max_tokens"`
    // and the JSON is usually unterminated — better to fail loudly than to
    // try to parse half a quote.
    if (payload.stop_reason === "max_tokens") {
      console.error("[ai-capture-quote] Claude hit max_tokens — response truncated");
      throw new Error("That's a lot of detail — try splitting it into a couple of shorter recordings.");
    }
    const text = payload.content?.find((c) => c.type === "text")?.text ?? "";
    // Prefer a ```json fenced block when Claude wraps the object; otherwise
    // extract the FIRST brace-balanced object. The previous greedy regex
    // `/\{[\s\S]*\}/` spans from the first `{` to the LAST `}`, which
    // swallows trailing prose / extra blocks into the parse and can yield
    // a superset object that QuoteSchema.parse accepts with garbage fields.
    const jsonStr = extractFirstJsonObject(text);
    if (!jsonStr) throw new Error("Claude returned no JSON");

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      throw new Error("Claude returned malformed JSON");
    }
    const result = QuoteSchema.parse(parsed);
    // Safety: strip any "— estimate, please confirm" suffix into the structured flag.
    const ESTIMATE_SUFFIX_RE = /\s*[—\-–]\s*estimate,?\s*please confirm\.?\s*$/i;
    result.line_items = result.line_items.map((li) => {
      const hadSuffix = ESTIMATE_SUFFIX_RE.test(li.description);
      const cleaned = li.description.replace(ESTIMATE_SUFFIX_RE, "").trim();
      return {
        ...li,
        description: cleaned || li.description,
        is_estimate: !!li.is_estimate || hadSuffix,
      };
    });
    result.title = result.title.replace(/\s*[—\-–]\s*estimate.*$/i, "").trim();
    return result;
  });
