import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Server-side QTR reference allocator.
 *
 * Walks the authenticated user's existing quotes and returns the next
 * `QTR-NNN` (zero-padded to 3, grows naturally beyond 999). Runs as the
 * signed-in user (RLS scopes the SELECT) so it can't peek at other users'
 * refs.
 *
 * Concurrency: there is a small TOCTOU window between SELECT and the
 * subsequent INSERT. The DB has a partial UNIQUE index
 * `quotes_user_ref_idx (user_id, ref) WHERE ref IS NOT NULL` so a true
 * collision surfaces as Postgres 23505; callers retry by re-allocating.
 */
export const allocateQuoteRef = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ref: string }> => {
    const { data, error } = await context.supabase
      .from("quotes")
      .select("ref")
      .eq("user_id", context.userId)
      .not("ref", "is", null);
    if (error) throw new Error(error.message);
    const nums = (data ?? [])
      .map((r) => Number((r.ref ?? "").replace(/[^0-9]/g, "")))
      .filter((n) => Number.isFinite(n) && n > 0);
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return { ref: `QTR-${String(next).padStart(3, "0")}` };
  });
