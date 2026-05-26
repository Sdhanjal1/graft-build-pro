import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyUser } from "@/lib/push.functions";

const CLIENT_DOCS_BUCKET = "client-docs";
const SIGNED_URL_TTL = 60 * 60; // 1 hour

// Convert a stored file_url (either a storage path or a legacy public URL)
// into a short-lived signed download URL. Returns null on failure.
function storagePathFromStored(stored: string): string | null {
  if (!stored) return null;
  const marker = `/${CLIENT_DOCS_BUCKET}/`;
  const idx = stored.indexOf(marker);
  if (idx >= 0) return stored.slice(idx + marker.length);
  // Already a path
  return stored.replace(/^\/+/, "");
}

async function signClientDoc(stored: string): Promise<string> {
  const path = storagePathFromStored(stored);
  if (!path) return stored;
  const { data, error } = await supabaseAdmin.storage
    .from(CLIENT_DOCS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (error || !data) return "";
  return data.signedUrl;
}

async function signDocs<T extends { file_url: string }>(rows: T[]): Promise<T[]> {
  return Promise.all(
    rows.map(async (r) => ({ ...r, file_url: await signClientDoc(r.file_url) })),
  );
}

// ---------- Public: fetch portal data by client code ----------
const PORTAL_LINK_TTL_DAYS = 90;

function assertPortalNotExpired(portal_issued_at: string | null | undefined) {
  if (!portal_issued_at) return;
  const ageDays = (Date.now() - new Date(portal_issued_at).getTime()) / 86_400_000;
  if (ageDays > PORTAL_LINK_TTL_DAYS) {
    throw new Error("This portal link has expired. Please contact your tradesperson for a new link.");
  }
}
export const getClientPortalData = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code: z.string().min(8).max(64) }).parse(d))
  .handler(async ({ data }) => {
    const { data: client, error } = await supabaseAdmin
      .from("clients")
      .select("id, user_id, name, address, portal_code, portal_active, portal_issued_at, service_due_date, service_type")
      .eq("portal_code", data.code)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!client) throw new Error("Portal not found");
    if (!client.portal_active) throw new Error("Portal disabled");
    assertPortalNotExpired(client.portal_issued_at);

    const [{ data: profile }, { data: quotes }, { data: documents }, { data: messages }] =
      await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("id, business_name, full_name, logo_url, phone, email")
          .eq("id", client.user_id)
          .maybeSingle(),
        supabaseAdmin
          .from("quotes")
          .select("id, ref, title, total, subtotal, vat_amount, vat_registered, status, created_at, line_items, job_description, payment_timing, deposit_amount, deposit_percent, completed_at")
          .eq("client_id", client.id)
          .eq("portal_visible", true)
          .order("created_at", { ascending: false }),
        supabaseAdmin
          .from("client_documents")
          .select("id, title, kind, file_url, created_at")
          .eq("client_id", client.id)
          .eq("portal_visible", true)
          .order("created_at", { ascending: false }),
        supabaseAdmin
          .from("client_portal_messages")
          .select("id, sender, body, created_at")
          .eq("client_id", client.id)
          .order("created_at", { ascending: true }),
      ]);

    return {
      client: {
        id: client.id,
        name: client.name,
        address: client.address,
        service_due_date: client.service_due_date,
        service_type: client.service_type,
      },
      profile: profile ?? null,
      quotes: quotes ?? [],
      documents: await signDocs(documents ?? []),
      messages: messages ?? [],
    };
  });

// ---------- Public: customer posts a message ----------
export const postClientPortalMessage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      code: z.string().min(8).max(32),
      body: z.string().min(1).max(4000),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("id, user_id, portal_active, portal_issued_at")
      .eq("portal_code", data.code)
      .maybeSingle();
    if (!client || !client.portal_active) throw new Error("Portal not available");
    assertPortalNotExpired(client.portal_issued_at);

    const { data: msg, error } = await supabaseAdmin
      .from("client_portal_messages")
      .insert({
        client_id: client.id,
        user_id: client.user_id,
        sender: "customer",
        body: data.body,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Push notify the pro (don't block on failure)
    try {
      const { data: c } = await supabaseAdmin
        .from("clients")
        .select("name")
        .eq("id", client.id)
        .maybeSingle();
      await notifyUser(client.user_id, {
        title: `New message from ${c?.name ?? "a customer"}`,
        body: data.body.slice(0, 140),
        url: `/clients/${client.id}`,
        tag: `portal-msg-${client.id}`,
      });
    } catch (e) {
      console.error("portal push notify failed", e);
    }

    return { message: msg };
  });

// ---------- Public: customer accepts or declines a quote ----------
export const respondQuoteFromPortal = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      code: z.string().min(8).max(32),
      quoteId: z.string().uuid(),
      response: z.enum(["accepted", "declined"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("id, user_id, name, portal_active, portal_issued_at")
      .eq("portal_code", data.code)
      .maybeSingle();
    if (!client || !client.portal_active) throw new Error("Portal not available");
    assertPortalNotExpired(client.portal_issued_at);

    const { data: quote } = await supabaseAdmin
      .from("quotes")
      .select("id, status, title, total, ref")
      .eq("id", data.quoteId)
      .eq("client_id", client.id)
      .eq("portal_visible", true)
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

    const note =
      data.response === "accepted"
        ? `✅ ${client.name ?? "Customer"} accepted quote ${quote.ref ?? ""}`.trim()
        : `❌ ${client.name ?? "Customer"} declined quote ${quote.ref ?? ""}`.trim();
    await supabaseAdmin.from("client_portal_messages").insert({
      client_id: client.id,
      user_id: client.user_id,
      sender: "customer",
      body: note,
    });
    try {
      await notifyUser(client.user_id, {
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

// ---------- Pro: regenerate portal code ----------
export const regeneratePortalCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const code = Array.from(bytes, (b) => chars[b % chars.length]).join("");
    const { error } = await context.supabase
      .from("clients")
      .update({ portal_code: code, portal_issued_at: new Date().toISOString() })
      .eq("id", data.clientId);
    if (error) throw new Error(error.message);
    return { portal_code: code };
  });

// ---------- Pro: toggle portal active ----------
export const togglePortalActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ clientId: z.string().uuid(), active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("clients")
      .update({ portal_active: data.active })
      .eq("id", data.clientId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Pro: toggle quote visibility in portal ----------
export const toggleQuotePortalVisible = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ quoteId: z.string().uuid(), visible: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("quotes")
      .update({ portal_visible: data.visible })
      .eq("id", data.quoteId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Pro: toggle document visibility ----------
export const toggleDocumentPortalVisible = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ documentId: z.string().uuid(), visible: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("client_documents")
      .update({ portal_visible: data.visible })
      .eq("id", data.documentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Pro: list client documents ----------
export const listClientDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("client_documents")
      .select("*")
      .eq("client_id", data.clientId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { documents: await signDocs(rows ?? []) };
  });

// ---------- Pro: add document (file already uploaded to storage) ----------
export const addClientDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      clientId: z.string().uuid(),
      title: z.string().min(1).max(200),
      kind: z.enum(["certificate", "service", "warranty", "other"]).default("other"),
      file_url: z.string().min(1).max(1024),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("client_documents")
      .insert({
        client_id: data.clientId,
        user_id: context.userId,
        title: data.title,
        kind: data.kind,
        file_url: data.file_url,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { document: { ...row, file_url: await signClientDoc(row.file_url) } };
  });

// ---------- Pro: delete document ----------
export const deleteClientDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ documentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("client_documents")
      .delete()
      .eq("id", data.documentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Pro: get client portal info (code, active, etc) ----------
export const getClientPortalInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: client, error } = await context.supabase
      .from("clients")
      .select("id, name, portal_code, portal_active, service_due_date, service_type")
      .eq("id", data.clientId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { client };
  });

// ---------- Pro: update service reminder ----------
export const updateServiceReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      clientId: z.string().uuid(),
      service_type: z.string().max(120).nullable(),
      service_due_date: z.string().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("clients")
      .update({
        service_type: data.service_type,
        service_due_date: data.service_due_date,
      })
      .eq("id", data.clientId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Pro: list client portal messages ----------
export const listClientPortalMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("client_portal_messages")
      .select("*")
      .eq("client_id", data.clientId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { messages: rows ?? [] };
  });

// ---------- Pro: send a message into the client portal thread ----------
export const sendProClientMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ clientId: z.string().uuid(), body: z.string().min(1).max(4000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("client_portal_messages")
      .insert({
        client_id: data.clientId,
        user_id: context.userId,
        sender: "pro",
        body: data.body,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { message: row };
  });

// ---------- Pro: get client portal code for a quote (used by SendQuoteDialog) ----------
export const getPortalCodeForQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ quoteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: quote } = await context.supabase
      .from("quotes")
      .select("client_id")
      .eq("id", data.quoteId)
      .maybeSingle();
    if (!quote?.client_id) return { portal_code: null };
    const { data: client } = await context.supabase
      .from("clients")
      .select("portal_code, portal_active")
      .eq("id", quote.client_id)
      .maybeSingle();
    return {
      portal_code: client?.portal_active ? client?.portal_code ?? null : null,
    };
  });

// ---------- Pro: portal link status for a quote (expiry banner on quote detail) ----------
export const getPortalLinkStatusForQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ quoteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: quote } = await context.supabase
      .from("quotes")
      .select("client_id")
      .eq("id", data.quoteId)
      .maybeSingle();
    if (!quote?.client_id) return null;
    const { data: client } = await context.supabase
      .from("clients")
      .select("id, name, portal_code, portal_active, portal_issued_at")
      .eq("id", quote.client_id)
      .maybeSingle();
    if (!client) return null;
    const ttlDays = 90;
    const issuedMs = client.portal_issued_at ? new Date(client.portal_issued_at).getTime() : Date.now();
    const ageDays = (Date.now() - issuedMs) / 86_400_000;
    const daysRemaining = Math.ceil(ttlDays - ageDays);
    return {
      client_id: client.id,
      client_name: client.name,
      portal_code: client.portal_code,
      portal_active: client.portal_active,
      portal_issued_at: client.portal_issued_at,
      days_remaining: daysRemaining,
      expired: daysRemaining <= 0,
    };
  });
