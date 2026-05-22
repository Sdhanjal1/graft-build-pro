import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";

export type ConnectStatus = {
  loading: boolean;
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  /** Pro can accept card payments via Connect. */
  ready: boolean;
  refresh: () => Promise<void>;
};

export function useConnectStatus(): ConnectStatus {
  const { user } = useSession();
  const [state, setState] = useState({
    loading: true,
    accountId: null as string | null,
    chargesEnabled: false,
    payoutsEnabled: false,
  });

  const load = useCallback(async () => {
    if (!user) {
      setState({ loading: false, accountId: null, chargesEnabled: false, payoutsEnabled: false });
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select(
        "stripe_connect_account_id, stripe_connect_charges_enabled, stripe_connect_payouts_enabled",
      )
      .eq("id", user.id)
      .maybeSingle();
    setState({
      loading: false,
      accountId: data?.stripe_connect_account_id ?? null,
      chargesEnabled: !!data?.stripe_connect_charges_enabled,
      payoutsEnabled: !!data?.stripe_connect_payouts_enabled,
    });
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`connect:${user.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user, load]);

  return {
    ...state,
    ready: !!state.accountId && state.chargesEnabled,
    refresh: load,
  };
}
