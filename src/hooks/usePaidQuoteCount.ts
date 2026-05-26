import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const LEARNED_MIN_PAID_QUOTES = 3;
const PAID_QUOTE_COUNT_KEY = ["paid-quote-count"] as const;

async function fetchPaidQuoteCount(): Promise<number> {
  const { count, error } = await supabase
    .from("quotes")
    .select("id", { count: "exact", head: true })
    .eq("status", "paid");
  if (error) return 0;
  return count ?? 0;
}

export function usePaidQuoteCount() {
  const { data } = useQuery({
    queryKey: PAID_QUOTE_COUNT_KEY,
    queryFn: fetchPaidQuoteCount,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  return data ?? 0;
}

export function useInvalidatePaidQuoteCount() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: PAID_QUOTE_COUNT_KEY });
}

/** Treat 'learned' as 'ai' until the user has enough paid quotes to back it up. */
export function normalizeSource<T extends string | undefined | null>(
  src: T,
  paidCount: number,
): "voice" | "learned" | "ai" {
  const s = (src ?? "ai") as string;
  if (s === "learned" && paidCount < LEARNED_MIN_PAID_QUOTES) return "ai";
  if (s === "voice" || s === "learned" || s === "ai") return s;
  return "ai";
}
