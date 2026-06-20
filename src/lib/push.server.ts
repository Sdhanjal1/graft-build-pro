import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendWebPush, type PushPayload } from "@/lib/web-push.server";
import { recordNotification, type NotificationKind } from "@/lib/notifications.server";

export type NotifyOptions = {
  /** Short tag for the inbox row (and push dedupe). Used to prevent duplicate inbox rows on replays. */
  kind?: NotificationKind | string;
  /** When true, skip persisting an inbox row (push only). Defaults to false. */
  skipInbox?: boolean;
};

/** Server-internal helper: notify a user across all their devices and record an inbox row. */
export async function notifyUser(
  userId: string,
  payload: PushPayload,
  opts: NotifyOptions = {},
): Promise<void> {
  // Persist inbox row first so a missed push is still visible.
  if (!opts.skipInbox) {
    await recordNotification({
      userId,
      kind: opts.kind ?? payload.tag ?? "general",
      title: payload.title,
      body: payload.body,
      url: payload.url,
      tag: payload.tag,
    });
  }

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (!subs || subs.length === 0) return;
  await Promise.all(
    subs.map(async (s) => {
      try {
        const res = await sendWebPush(s as any, payload);
        // 404 / 410, subscription is dead, clean up
        if (res.status === 404 || res.status === 410) {
          const { error: delErr } = await supabaseAdmin
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", s.endpoint);
          if (delErr) {
            console.error("[push] cleanup of dead subscription failed", {
              endpoint: s.endpoint,
              status: res.status,
              error: delErr.message,
            });
          }
        }
      } catch (e) {
        console.error("push send failed", s.endpoint, e);
      }
    }),
  );
}
