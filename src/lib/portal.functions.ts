import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ---------- Public: fetch portal data by client code ----------
export const getClientPortalData = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code: z.string().min(8).max(32) }).parse(d))
  .handler(async ({ data }) => {
    const { data: client, error } = await supabaseAdmin
      .from("clients")
      .select("id, user_id, name, address, portal_code, portal_active, service_due_date, service_type")
      .eq("portal_code", data.code)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!client) throw new Error("Portal not found");
    if (!client.portal_active) throw new Error("Portal disabled");

    const [{ data: profile }, { data: quotes }, { data: documents }, { data: messages }] =
      await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("id, business_name, full_name, logo_url, phone, email")
          .eq("id", client.user_id)
          .maybeSingle(),
        supabaseAdmin
          .from("quotes")
          .select("id, ref, title, total, subtotal, vat_amount, vat_registered, status, created_at, line_items, job_description")
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
        service_due_date: client.service_due_date,
        service_type: client.service_type,
      },
      profile: profile ?? null,
      quotes: quotes ?? [],
      documents: documents ?? [],
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
      .select("id, user_id, portal_active")
      .eq("portal_code", data.code)
      .maybeSingle();
    if (!client || !client.portal_active) throw new Error("Portal not available");

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
    return { message: msg };
  });

// ---------- Pro: regenerate portal code ----------
export const regeneratePortalCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 12; i++) code += chars[Math.floor(Math.random() * chars.length)];
    const { error } = await context.supabase
      .from("clients")
      .update({ portal_code: code })
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
    return { documents: rows ?? [] };
  });

// ---------- Pro: add document (file already uploaded to storage) ----------
export const addClientDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      clientId: z.string().uuid(),
      title: z.string().min(1).max(200),
      kind: z.enum(["certificate", "service", "warranty", "other"]).default("other"),
      file_url: z.string().url(),
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
    return { document: row };
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
