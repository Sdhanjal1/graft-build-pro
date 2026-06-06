// Shared helpers for the pricing-memory system. Pure functions, safe to import
// from both client and server.

export type LineItemSource = "voice" | "learned" | "ai";

export type PricingPattern = {
  id: string;
  item_description: string;
  item_category: string;
  typical_price: number;
  price_count: number;
  price_min: number;
  price_max: number;
  last_quoted_at: string;
};

/** Normalise a line item description for stable matching. */
export function normalizeDescription(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[£$€]/g, " ")
    .replace(/\b\d+(\.\d+)?\s*(hrs?|hours?|days?|mins?)\b/g, " ") // strip "6 hours"
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

/** Infer a coarse category from a description, for the labour-rate stat. */
export function inferCategory(description: string): string {
  const d = description.toLowerCase();
  if (/\b(hour|hr|labour|labor|day rate|day's? labour)\b/.test(d)) return "labour";
  if (/\b(boiler|combi|worcester|vaillant|baxi|ideal|greenstar)\b/.test(d)) return "boiler";
  if (/\b(radiator|rad\b)/.test(d)) return "radiator";
  if (/\b(consumer unit|fuse box|eicr|cable|socket|spur|cu\b)/.test(d)) return "electrical";
  if (/\b(tile|grout|adhesive|cement|plaster|paint)\b/.test(d)) return "materials";
  if (/\b(fit|fitting|install|installation)\b/.test(d)) return "fitting";
  return "other";
}

export function badgeLabelFor(source: LineItemSource | undefined): string | null {
  if (source === "voice") return "Your price";
  if (source === "learned") return "Your usual price";
  if (source === "ai") return "Quottr suggested";
  return null;
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "for", "to", "in", "on", "at", "with",
  "by", "from", "is", "it", "be", "as", "this", "that", "new", "old", "per", "plus",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/**
 * Rank pricing patterns by token-overlap relevance against a free-text job
 * description. Returns a new array (highest score first); ties broken by price_count.
 */
export function rankPatternsForJob(
  patterns: PricingPattern[],
  jobText: string,
  limit = 30,
): PricingPattern[] {
  if (!patterns.length) return patterns;
  const jobTokens = new Set(tokenize(jobText));
  if (!jobTokens.size) return patterns.slice(0, limit);

  // Only treat patterns as authoritative when quoted at least twice.
  // One-off prices stay advisory — they may be typos, discounts, or test data.
  const scored = patterns.map((p) => {
    const tokens = tokenize(p.item_description);
    let score = 0;
    for (const t of tokens) if (jobTokens.has(t)) score += 1;
    const isAdvisory = (p.price_count || 0) < 2;
    return { p, score, isAdvisory };
  });

  scored.sort((a, b) => {
    // Authoritative tier always ranks above advisory tier.
    if (a.isAdvisory !== b.isAdvisory) return a.isAdvisory ? 1 : -1;
    if (b.score !== a.score) return b.score - a.score;
    return (b.p.price_count || 0) - (a.p.price_count || 0);
  });

  return scored.slice(0, limit).map((s) => s.p);
}


