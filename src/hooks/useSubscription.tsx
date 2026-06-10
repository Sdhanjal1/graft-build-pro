import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";

export type SubscriptionRow = {
  id: string;
  user_id: string;
  status: string;
  trial_start: string;
  trial_end: string;
  current_period_end: string | null;
  has_payment_method: boolean;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  environment: string;
};

export type SubscriptionState = {
  loading: boolean;
  sub: SubscriptionRow | null;
  /** True if user can use the app right now (trial active OR active sub). */
  canUse: boolean;
  /** True if write actions (send/generate quotes) should be blocked. */
  blocked: boolean;
  /** Days remaining in trial (0 if expired or no trial). */
  trialDaysLeft: number;
  /** Hours into the trial, used for "Day 12/14" copy. */
  trialDay: number;
  /** Show amber warning banner (last 3 days of trial, no card yet). */
  showWarn: boolean;
  /** Show red expired banner. */
  showExpired: boolean;
  refresh: () => Promise<void>;
};

export function useSubscription(): SubscriptionState {
  const { user } = useSession();
  const [sub, setSub] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setSub(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    setSub((data as SubscriptionRow | null) ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime updates so the banner clears the moment the webhook lands.
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`sub:${user.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user, load]);

  const now = Date.now();
  const trialEnd = sub?.trial_end ? new Date(sub.trial_end).getTime() : 0;
  const trialStart = sub?.trial_start ? new Date(sub.trial_start).getTime() : 0;
  const msLeft = Math.max(0, trialEnd - now);
  const trialDaysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
  const trialDay = Math.min(
    14,
    Math.max(0, Math.ceil((now - trialStart) / (1000 * 60 * 60 * 24))),
  );

  const status = sub?.status ?? "trialing";
  const inTrial = status === "trialing" && trialEnd > now;
  const activeSub = status === "active" || status === "past_due";

  const canUse = !!sub && (inTrial || activeSub);
  const blocked = !canUse;
  const showWarn = inTrial && !sub?.has_payment_method && trialDaysLeft <= 3;
  const showExpired = !canUse;

  return {
    loading,
    sub,
    canUse,
    blocked,
    trialDaysLeft,
    trialDay,
    showWarn,
    showExpired,
    refresh: load,
  };
}
