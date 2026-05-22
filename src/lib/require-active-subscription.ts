import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Gates server functions behind an active Quottr subscription.
 *
 * Allowed when ANY of:
 *  - status === "trialing" AND trial_end is in the future
 *  - status === "active"
 *  - status === "past_due"   (Stripe is retrying — keep them working during dunning)
 *
 * Otherwise throws an Error with `status: 402` so the caller can show an
 * "Add a payment method to continue" prompt. Customers using magic-link
 * portal routes never hit this middleware (those server fns don't apply it).
 */
export const requireActiveSubscription = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };

    const { data: sub, error } = await supabase
      .from("subscriptions")
      .select("status, trial_end")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      // Don't block on transient DB errors — log and let the request through.
      console.error("[requireActiveSubscription] subscription lookup failed", error);
      return next();
    }

    const now = Date.now();
    const status = sub?.status as string | undefined;
    const trialEnd = sub?.trial_end ? new Date(sub.trial_end).getTime() : 0;

    const allowed =
      (status === "trialing" && trialEnd > now) ||
      status === "active" ||
      status === "past_due";

    if (!allowed) {
      const err = new Error(
        "Your Quottr trial has ended. Add a payment method to continue using the app.",
      ) as Error & { status?: number };
      err.status = 402;
      throw err;
    }

    return next();
  });
