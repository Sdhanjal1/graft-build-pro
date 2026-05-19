import { supabase } from "@/integrations/supabase/client";

export type CaptureSource = "manual" | "voice" | "chip";

export type SiteCapture = {
  id: string;
  user_id: string;
  customer_name: string | null;
  address: string | null;
  trade_type: string | null;
  vat_registered: boolean;
  status: "active" | "generated" | "archived";
  generated_quote_id: string | null;
  started_at: string;
  created_at: string;
  updated_at: string;
};

export type SiteCaptureItem = {
  id: string;
  capture_id: string;
  user_id: string;
  description: string;
  source: CaptureSource;
  position: number;
  created_at: string;
};

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Not signed in");
  return data.user.id;
}

export const QUICK_CHIPS = [
  "Radiator",
  "Boiler service",
  "Power flush",
  "TRV",
  "Stopcock",
  "Leak repair",
  "Pipe work",
  "Thermostat",
  "Hot water cylinder",
  "Other",
];

export async function createSiteCapture(input: {
  customerName?: string;
  address?: string;
  tradeType?: string;
  vatRegistered?: boolean;
}): Promise<SiteCapture> {
  const user_id = await requireUserId();
  const { data, error } = await supabase
    .from("site_captures")
    .insert({
      user_id,
      customer_name: input.customerName ?? null,
      address: input.address ?? null,
      trade_type: input.tradeType ?? null,
      vat_registered: input.vatRegistered ?? false,
      status: "active",
    } as never)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as SiteCapture;
}

export async function listActiveCaptures(): Promise<SiteCapture[]> {
  const { data, error } = await supabase
    .from("site_captures")
    .select("*")
    .eq("status", "active")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as SiteCapture[];
}

export async function getCapture(id: string): Promise<SiteCapture | null> {
  const { data, error } = await supabase
    .from("site_captures")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as SiteCapture) ?? null;
}

export async function updateCapture(
  id: string,
  patch: Partial<Pick<SiteCapture, "customer_name" | "address" | "trade_type" | "vat_registered" | "status" | "generated_quote_id">>,
): Promise<void> {
  const { error } = await supabase
    .from("site_captures")
    .update(patch as never)
    .eq("id", id);
  if (error) throw error;
}

export async function listCaptureItems(captureId: string): Promise<SiteCaptureItem[]> {
  const { data, error } = await supabase
    .from("site_capture_items")
    .select("*")
    .eq("capture_id", captureId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as SiteCaptureItem[];
}

export async function addCaptureItem(input: {
  captureId: string;
  description: string;
  source: CaptureSource;
  position: number;
}): Promise<SiteCaptureItem> {
  const user_id = await requireUserId();
  const { data, error } = await supabase
    .from("site_capture_items")
    .insert({
      capture_id: input.captureId,
      user_id,
      description: input.description,
      source: input.source,
      position: input.position,
    } as never)
    .select("*")
    .single();
  if (error) throw error;
  // bump capture updated_at
  await supabase
    .from("site_captures")
    .update({ updated_at: new Date().toISOString() } as never)
    .eq("id", input.captureId);
  return data as unknown as SiteCaptureItem;
}

export async function updateCaptureItem(id: string, description: string): Promise<void> {
  const { error } = await supabase
    .from("site_capture_items")
    .update({ description } as never)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteCaptureItem(id: string): Promise<void> {
  const { error } = await supabase.from("site_capture_items").delete().eq("id", id);
  if (error) throw error;
}

export function captureTitle(c: Pick<SiteCapture, "customer_name" | "address">): string {
  return c.customer_name?.trim() || c.address?.trim() || "Untitled site";
}
