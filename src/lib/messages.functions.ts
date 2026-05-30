import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireActiveSubscription } from "@/lib/require-active-subscription";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ---------- Pro: create/get portal token for a quote ----------
export const ensurePortalToken = createServerFn({ method: "POST" })
  .middleware([requireActiveSubscription])
  .inputValidator((d: unknown) =>
    z.object({
      quoteId: z.string().min(1).max(120),
      channel: z.enum(["sms", "email", "manual"]).default("manual"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = Date.now();
    const { data: existing } = await supabase
      .from("quote_portal_tokens")
      .select("token, expires_at")
      .eq("quote_id", data.quoteId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing?.token && existing.expires_at && new Date(existing.expires_at).getTime() > now) {
      return { token: existing.token, expiresAt: existing.expires_at };
    }

    const token = crypto.randomUUID().replace(/-/g, "") + Math.random().toString(36).slice(2, 8);
    // Tokens valid for 30 days
    const expiresAt = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
    // Upsert (if a stale record exists, replace it)
    if (existing?.token) {
      const { error } = await supabase
        .from("quote_portal_tokens")
        .update({ token, channel: data.channel, expires_at: expiresAt, created_at: new Date().toISOString() })
        .eq("quote_id", data.quoteId)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("quote_portal_tokens").insert({
        quote_id: data.quoteId,
        user_id: userId,
        token,
        channel: data.channel,
        expires_at: expiresAt,
      });
      if (error) throw new Error(error.message);
    }
    return { token, expiresAt };
  });

// ---------- Pro: list messages for a quote ----------
export const listQuoteMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ quoteId: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("quote_messages")
      .select("*")
      .eq("quote_id", data.quoteId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { messages: rows ?? [] };
  });

// ---------- Pro: send a message into the thread ----------
export const sendProMessage = createServerFn({ method: "POST" })
  .middleware([requireActiveSubscription])
  .inputValidator((d: unknown) =>
    z.object({
      quoteId: z.string().min(1).max(120),
      body: z.string().min(1).max(4000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("quote_messages")
      .insert({ quote_id: data.quoteId, user_id: userId, sender: "pro", body: data.body })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { message: row };
  });

// ---------- Pro: inbox (latest message per quote) ----------
export const getInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("quote_messages")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { messages: rows ?? [] };
  });

// ---------- Public: resolve token -> quote + messages ----------
export const getPortalData = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(8).max(128) }).parse(d))
  .handler(async ({ data }) => {
    const { data: tk } = await supabaseAdmin
      .from("quote_portal_tokens")
      .select("quote_id, user_id, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!tk) throw new Error("Invalid or expired link");
    if (tk.expires_at && new Date(tk.expires_at).getTime() < Date.now()) {
      throw new Error("This link has expired. Please ask for a new one.");
    }

    const [{ data: quote }, { data: messages }, { data: profile }, { data: payment }] = await Promise.all([
      supabaseAdmin
        .from("quotes")
        .select("id, ref, title, job_description, line_items, subtotal, vat_amount, total, vat_registered, status, created_at, due_date, client_id, payment_timing, deposit_amount, deposit_percent, completed_at")
        .eq("id", tk.quote_id)
        .maybeSingle(),
      supabaseAdmin
        .from("quote_messages")
        .select("id, sender, body, created_at")
        .eq("quote_id", tk.quote_id)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("profiles")
        .select("business_name, full_name, phone, email, town, address_line_1, address_line_2, postcode, registration_number, vat_registered, vat_number, logo_url, quote_intro, quote_footer, signature_name, show_signature, stripe_connect_charges_enabled, bank_account_name, bank_name, sort_code, account_number, payment_reference_note")
        .eq("id", tk.user_id)
        .maybeSingle(),
      supabaseAdmin
        .from("invoice_payments")
        .select("paid_at, payment_method, stripe_payment_intent, amount_cents, currency, status")
        .eq("quote_id", tk.quote_id)
        .eq("status", "paid")
        .order("paid_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (!quote) throw new Error("Quote not found");
    let client: any = null;
    if (quote.client_id) {
      const { data: c } = await supabaseAdmin
        .from("clients")
        .select("name, address, email, phone")
        .eq("id", quote.client_id)
        .maybeSingle();
      client = c;
    }
    return { quote, messages: messages ?? [], profile, client, payment };
  });

// ---------- Public: customer posts a message ----------
function isWithinWorkingHours(schedule: any, tz: string): boolean {
  try {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(now);
    const wd = (fmt.find((p) => p.type === "weekday")?.value ?? "").toLowerCase().slice(0, 3);
    const hh = fmt.find((p) => p.type === "hour")?.value ?? "00";
    const mm = fmt.find((p) => p.type === "minute")?.value ?? "00";
    const cur = `${hh}:${mm}`;
    const day = schedule?.[wd];
    if (!day?.enabled) return false;
    return cur >= day.start && cur <= day.end;
  } catch {
    return true;
  }
}

export const postPortalMessage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      token: z.string().min(8).max(128),
      body: z.string().min(1).max(4000),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: tk } = await supabaseAdmin
      .from("quote_portal_tokens")
      .select("quote_id, user_id, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!tk) throw new Error("Invalid link");
    if (tk.expires_at && new Date(tk.expires_at).getTime() < Date.now()) {
      throw new Error("This link has expired.");
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("quote_messages")
      .insert({
        quote_id: tk.quote_id,
        user_id: tk.user_id,
        sender: "customer",
        body: data.body,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Auto-reply if outside working hours
    const { data: wh } = await supabaseAdmin
      .from("working_hours")
      .select("dnd_enabled, schedule, auto_reply, timezone")
      .eq("user_id", tk.user_id)
      .maybeSingle();

    let autoReply: any = null;
    if (wh?.dnd_enabled && !isWithinWorkingHours(wh.schedule, wh.timezone || "Europe/London")) {
      const { data: ar } = await supabaseAdmin
        .from("quote_messages")
        .insert({
          quote_id: tk.quote_id,
          user_id: tk.user_id,
          sender: "system",
          body: wh.auto_reply,
        })
        .select()
        .single();
      autoReply = ar;
    }
    // Notify pro of new customer message
    try {
      const { notifyUser } = await import("@/lib/push.server");
      void notifyUser(tk.user_id, {
        title: "New customer message",
        body: data.body.slice(0, 140),
        url: "/messages",
        tag: `msg-${tk.quote_id}`,
      });
    } catch (e) { console.error("push notify failed", e); }
    return { message: inserted, autoReply };
  });

// ---------- Public: customer accepts or declines a quote (token-based) ----------
export const respondToQuoteByToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      token: z.string().min(8).max(128),
      response: z.enum(["accepted", "declined"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: tk } = await supabaseAdmin
      .from("quote_portal_tokens")
      .select("quote_id, user_id, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!tk) throw new Error("Invalid link");
    if (tk.expires_at && new Date(tk.expires_at).getTime() < Date.now()) {
      throw new Error("This link has expired.");
    }

    const { data: quote } = await supabaseAdmin
      .from("quotes")
      .select("id, status, title, total, ref, client_id")
      .eq("id", tk.quote_id)
      .maybeSingle();
    if (!quote) throw new Error("Quote not found");
    if (!["pending", "sent"].includes(quote.status)) {
      throw new Error(`Quote already ${quote.status}`);
    }

    const { error } = await supabaseAdmin
      .from("quotes")
      .update({ status: data.response })
      .eq("id", quote.id);
    if (error) throw new Error(error.message);

    let customerName = "Customer";
    if (quote.client_id) {
      const { data: c } = await supabaseAdmin
        .from("clients")
        .select("name")
        .eq("id", quote.client_id)
        .maybeSingle();
      if (c?.name) customerName = c.name;
    }

    const note =
      data.response === "accepted"
        ? `✅ ${customerName} accepted quote ${quote.ref ?? ""}`.trim()
        : `❌ ${customerName} declined quote ${quote.ref ?? ""}`.trim();
    await supabaseAdmin.from("quote_messages").insert({
      quote_id: quote.id,
      user_id: tk.user_id,
      sender: "system",
      body: note,
    });

    try {
      const { notifyUser } = await import("@/lib/push.server");
      void notifyUser(tk.user_id, {
        title: data.response === "accepted" ? "Quote accepted 🎉" : "Quote declined",
        body: `${quote.title} · £${Number(quote.total).toFixed(2)}`,
        url: `/quotes/${quote.id}`,
        tag: `quote-${quote.id}-${data.response}`,
      });
    } catch (e) {
      console.error("portal push notify failed", e);
    }

    return { ok: true, status: data.response };
  });
