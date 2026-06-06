import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { inferCategory, normalizeDescription, type PricingPattern } from "@/lib/pricing-patterns";

type SupabaseLike = {
  from: (t: string) => any;
};

/**
 * Server-only: fetch a user's top-N pricing patterns by quote count.
 * Used internally by the AI quote generators — NOT exported as a serverFn.
 */
export async function fetchTopPatterns(
  supabase: SupabaseLike,
  userId: string,
  limit = 50,
): Promise<PricingPattern[]> {
  // Fetch two passes and merge-dedupe by id: "go-to items" (most-quoted) +
  // "recent items" (what they quoted lately). Keeps long-tail go-tos visible
  // while always surfacing recently-priced work for the AI prompt.
  const perPass = Math.max(20, Math.ceil(limit * 0.75));
  const [byCount, byRecency] = await Promise.all([
    supabase
      .from("user_pricing_patterns")
      .select(
        "id, item_description, item_category, typical_price, price_count, price_min, price_max, last_quoted_at",
      )
      .eq("user_id", userId)
      .order("price_count", { ascending: false })
      .limit(perPass),
    supabase
      .from("user_pricing_patterns")
      .select(
        "id, item_description, item_category, typical_price, price_count, price_min, price_max, last_quoted_at",
      )
      .eq("user_id", userId)
      .order("last_quoted_at", { ascending: false })
      .limit(perPass),
  ]);
  if (byCount.error) console.error("[fetchTopPatterns] count pass failed", byCount.error);
  if (byRecency.error) console.error("[fetchTopPatterns] recency pass failed", byRecency.error);

  const seen = new Set<string>();
  const merged: PricingPattern[] = [];
  for (const row of [...(byCount.data ?? []), ...(byRecency.data ?? [])] as PricingPattern[]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
    if (merged.length >= limit) break;
  }
  return merged;
}

/** Format patterns as a compact, category-grouped block for Claude's system prompt. */
export function patternsForPrompt(patterns: PricingPattern[], trade?: string): string {
  if (!patterns.length) return "";
  // Plan 3: bumped from 10 → 20. Haiku 4.5 handles the extra tokens comfortably
  // and rankPatternsForJob already filtered by relevance upstream.
  const capped = patterns.slice(0, 20);
  const groups: Record<string, PricingPattern[]> = {};
  for (const p of capped) {
    const cat = p.item_category || "other";
    (groups[cat] ||= []).push(p);
  }
  const order = ["labour", "materials", "certificate", "cis_labour", "other"];
  const sections: string[] = [];
  for (const cat of order) {
    const rows = groups[cat];
    if (!rows?.length) continue;
    const lines = rows
      .map((p) => {
        const typical = `£${Number(p.typical_price).toFixed(2)}`;
        const min = Number(p.price_min);
        const max = Number(p.price_max);
        const range = min && max && min !== max ? ` (range £${min.toFixed(2)}–£${max.toFixed(2)})` : "";
        return `- ${p.item_description} — ${typical}${range}, n=${p.price_count}`;
      })
      .join("\n");
    sections.push(`${cat.toUpperCase()}:\n${lines}`);
  }
  const body = sections.join("\n\n");
  const tradeLine = trade
    ? `\nTradesperson: ${trade}. The patterns below are their actual historical prices for ${trade} work.\n`
    : "";
  return `\n\nLEARNED PATTERNS — this tradesperson's typical pricing from previous quotes.${tradeLine} RULES:\n1. ONLY use a learned pattern if the tradesperson explicitly mentioned that exact item (or an extremely obvious variant) in THIS JOB DESCRIPTION.\n2. Do NOT suggest or add items from this list just because they are related, common, or would typically go with the spoken work.\n3. If the current job mentions an item that matches one of these exactly (even with slightly different wording — e.g. "magnetic filter" vs "MagnaClean filter", "boiler install" vs "fit new combi"), USE THE LEARNED PRICE and set source: "learned". Do not substitute a generic UK estimate when a learned match exists.\n4. Keep their typical price even if it differs from your general UK trade knowledge — this is their pricing, not the market average.\n5. Categories below match the line item's category field. When you use a learned price, set the line item's category to match the section it came from.\n\n${body}`;
}



const LineItemInput = z.object({
  description: z.string().min(1).max(240),
  qty: z.number().nonnegative(),
  unit_price: z.number().nonnegative(),
});

const UpsertSchema = z.object({
  items: z.array(LineItemInput).min(1).max(40),
});

/**
 * Upsert pricing patterns from a saved quote's line items.
 * Computes a rolling average per (user, item).
 */
export const upsertPatternsFromQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: SupabaseLike; userId: string };
    let touched = 0;
    for (const li of data.items) {
      const price = Number(li.unit_price);
      if (!Number.isFinite(price) || price <= 0) continue;
      const desc = normalizeDescription(li.description);
      if (!desc) continue;

      const { data: existing } = await supabase
        .from("user_pricing_patterns")
        .select("id, typical_price, price_count, price_min, price_max")
        .eq("user_id", userId)
        .eq("item_description", desc)
        .maybeSingle();

      if (existing) {
        const count = Number(existing.price_count) || 0;
        const oldAvg = Number(existing.typical_price) || 0;
        const newAvg = (oldAvg * count + price) / (count + 1);
        await supabase
          .from("user_pricing_patterns")
          .update({
            typical_price: +newAvg.toFixed(2),
            price_count: count + 1,
            price_min: Math.min(Number(existing.price_min) || price, price),
            price_max: Math.max(Number(existing.price_max) || price, price),
            last_quoted_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("user_pricing_patterns").insert({
          user_id: userId,
          item_description: desc,
          item_category: inferCategory(li.description),
          typical_price: +price.toFixed(2),
          price_count: 1,
          price_min: price,
          price_max: price,
          last_quoted_at: new Date().toISOString(),
        });
      }
      touched++;
    }
    return { ok: true, count: touched };
  });

/** Aggregated insights for the dashboard. */
export const getPricingInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: SupabaseLike; userId: string };

    const { data: rows, error } = await supabase
      .from("user_pricing_patterns")
      .select(
        "item_description, item_category, typical_price, price_count, price_min, price_max, last_quoted_at",
      )
      .eq("user_id", userId)
      .order("price_count", { ascending: false });

    if (error) {
      console.error("[getPricingInsights] failed", error);
      return {
        total: 0,
        top: [] as Array<{
          description: string;
          typical_price: number;
          price_count: number;
          trend: "up" | "flat" | "down";
        }>,
        averageLabourRate: 0,
        labourSampleCount: 0,
      };
    }

    const all = (rows ?? []) as PricingPattern[];
    const top = all.slice(0, 5).map((p) => {
      const range = (Number(p.price_max) || 0) - (Number(p.price_min) || 0);
      const typical = Number(p.typical_price) || 0;
      let trend: "up" | "flat" | "down" = "flat";
      if (range > 0 && typical > 0) {
        const skew = (Number(p.price_max) - typical) / typical;
        if (skew > 0.08) trend = "up";
        else if (skew < -0.08) trend = "down";
      }
      return {
        description: p.item_description,
        typical_price: typical,
        price_count: p.price_count,
        trend,
      };
    });

    const labour = all.filter((p) => p.item_category === "labour");
    const labourAvg = labour.length
      ? labour.reduce((s, p) => s + Number(p.typical_price), 0) / labour.length
      : 0;

    return {
      total: all.length,
      top,
      averageLabourRate: +labourAvg.toFixed(2),
      labourSampleCount: labour.length,
    };
  });

/** Suggest a unit price for a free-text description from the user's own past pricing. */
const SuggestSchema = z.object({
  description: z.string().min(1).max(240),
});

export const suggestPriceForDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SuggestSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: SupabaseLike; userId: string };
    const normalized = normalizeDescription(data.description);
    if (!normalized || normalized.length < 2) return null;

    const { data: exact } = await supabase
      .from("user_pricing_patterns")
      .select("item_description, typical_price, price_count")
      .eq("user_id", userId)
      .eq("item_description", normalized)
      .maybeSingle();
    if (exact) {
      return {
        item_description: exact.item_description as string,
        typical_price: Number(exact.typical_price) || 0,
        price_count: Number(exact.price_count) || 0,
      };
    }

    const tokens = normalized.split(" ").filter((t) => t.length >= 3);
    if (!tokens.length) return null;
    const token = tokens.sort((a, b) => b.length - a.length)[0];
    const escaped = token.replace(/[%_\\]/g, "\\$&");
    const { data: matches } = await supabase
      .from("user_pricing_patterns")
      .select("item_description, typical_price, price_count")
      .eq("user_id", userId)
      .ilike("item_description", `%${escaped}%`)
      .order("price_count", { ascending: false })
      .limit(1);
    const best = matches?.[0];
    if (!best) return null;
    return {
      item_description: best.item_description as string,
      typical_price: Number(best.typical_price) || 0,
      price_count: Number(best.price_count) || 0,
    };
  });
