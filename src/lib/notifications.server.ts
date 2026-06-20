import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type NotificationKind =
  | "quote_request"
  | "customer_message"
  | "portal_message"
  | "quote_accepted"
  | "quote_declined"
  | "payment_paid"
  | "service_reminder"
  | "test";

export type RecordNotificationInput = {
  userId: string;
  kind: NotificationKind | string;
  title: string;
  body?: string;
  url?: string;
  tag?: string;
};

/**
 * Persist an inbox row for the user. Safe to fail — never throws to caller.
 * When `tag` is provided, the unique partial index dedupes replays.
 */
export async function recordNotification(input: RecordNotificationInput): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("notifications").insert({
      user_id: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      url: input.url ?? null,
      tag: input.tag ?? null,
    });
    if (error && error.code !== "23505") {
      // 23505 = unique_violation (duplicate tag — expected on replays)
      console.error("[notifications] insert failed", error.message);
    }
  } catch (e) {
    console.error("[notifications] insert threw", e);
  }
}
