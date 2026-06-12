import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { notifyUser } from "@/lib/push.server";

// Public, fetch a pro's basic info from their id (used on the request page before auth)
export const getProPublicInfo = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ proId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id, business_name, full_name, trade_type, town")
      .eq("id", data.proId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!profile) throw new Error("Tradesperson not found");
    return { profile };
  });

// Customer creates a new quote request
export const createQuoteRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      proId: z.string().uuid(),
      body: z.string().min(2).max(4000),
      source: z.enum(["text", "voice"]).default("text"),
      customerName: z.string().max(255).optional(),
      customerPhone: z.string().max(50).optional(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("quote_requests")
      .insert({
        pro_user_id: data.proId,
        customer_user_id: userId,
        body: data.body,
        source: data.source,
        customer_name: data.customerName ?? null,
        customer_phone: data.customerPhone ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    // Fire-and-forget push to pro across all their devices
    void notifyUser(data.proId, {
      title: data.customerName ? `New quote request from ${data.customerName}` : "New quote request",
      body: data.body.slice(0, 140),
      url: "/messages",
      tag: `req-${row?.id ?? Date.now()}`,
    });
    return { request: row };
  });

// Pro lists incoming quote requests
export const getMyIncomingRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("quote_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { requests: data ?? [] };
  });

export const markRequestRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("quote_requests")
      .update({ read_at: new Date().toISOString(), status: "seen" })
      .eq("id", data.id)
      .eq("pro_user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
