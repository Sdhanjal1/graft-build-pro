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
  const { data, error } = await supabase
    .from("user_pricing_patterns")
    .select(
      "id, item_description, item_category, typical_price, price_count, price_min, price_max, last_quoted_at",
    )
    .eq("user_id", userId)
    .order("price_count", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[fetchTopPatterns] failed", error);
    return [];
  }
  return (data ?? []) as PricingPattern[];
}

/** Format patterns as a compact block for Claude's system prompt. */
export function patternsForPrompt(patterns: PricingPattern[]): string {
  if (!patterns.length) return "";
  const lines = patterns
    .map((p) => {
      const price = `£${Number(p.typical_price).toFixed(2)}`;
      const count = p.price_count;
      return `- ${p.item_description}: ${price} (quoted ${count}×)`;
    })
    .join("\n");
  return `\n\nThis tradesperson has the following typical pricing based on their previous quotes. When generating this quote, use these prices for items they have quoted before and mark the line item with source: "learned". For items not in this list, use current UK trade pricing and mark them source: "ai". Spoken prices in the voice note always win and are marked source: "voice".\n\n${lines}`;
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
