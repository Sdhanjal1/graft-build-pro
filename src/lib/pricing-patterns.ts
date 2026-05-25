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
