import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendWebPush, type PushPayload } from "@/lib/web-push.server";

/** Server-internal helper: notify a user across all their devices. */
export async function notifyUser(userId: string, payload: PushPayload): Promise<void> {
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
          await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      } catch (e) {
        console.error("push send failed", s.endpoint, e);
      }
    }),
  );
}