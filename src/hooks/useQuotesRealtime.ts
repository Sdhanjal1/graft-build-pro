import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  applyRealtimeQuoteRow,
  removeRealtimeQuoteRow,
  markOverdueQuotes,
  ensureChasesFor,
  cancelChasesFor,
  getQuote,
} from "@/lib/user-data";

/**
 * Subscribes once per signed-in session to `public.quotes` changes for this
 * user and patches the in-memory store. This is what keeps the quotes list,
 * chaser, customer detail, and dashboard tiles in sync when status flips
 * happen elsewhere — Stripe webhook (accepted / paid), "Job done" pressed in
 * another tab, or overdue escalation on the server.
 */
export function useQuotesRealtime(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`quotes-rt-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "quotes", filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown> | null;
          if (!row || typeof row.id !== "string") return;
          applyRealtimeQuoteRow(row);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "quotes", filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown> | null;
          if (!row || typeof row.id !== "string") return;
          applyRealtimeQuoteRow(row);
          const quote = getQuote(row.id);
          if (!quote) return;
          // Keep the chaser queue honest without waiting for the chaser
          // screen to mount.
          if (quote.status === "paid" || quote.status === "declined") {
            cancelChasesFor(quote.id);
          } else if (quote.status === "completed" || quote.status === "overdue") {
            ensureChasesFor(quote);
          }
          // A row that landed `completed` may already be past its invoice
          // due date — let the local escalation flip it to `overdue` so it
          // shows in the right section.
          if (quote.status === "completed") {
            void markOverdueQuotes();
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "quotes", filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.old as Record<string, unknown> | null;
          if (!row || typeof row.id !== "string") return;
          removeRealtimeQuoteRow(row.id);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);
}
