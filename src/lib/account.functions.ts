import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Permanently delete the signed-in user's account and all associated data.
 * Required by UK GDPR and Apple App Store Guideline 5.1.1(v).
 *
 * RLS-scoped tables with user_id cascade implicitly because we delete the auth
 * user — but we also explicitly clear them first so anything missing a
 * foreign-key cascade (which is most of this schema) actually goes away.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };

    // Tables with a user_id column — wipe before deleting the auth user.
    const tables = [
      "quote_messages",
      "quote_portal_tokens",
      "quote_requests",
      "quotes",
      "site_capture_items",
      "site_captures",
      "client_documents",
      "client_portal_messages",
      "clients",
      "invoice_payments",
      "push_subscriptions",
      "working_hours",
      "subscriptions",
      "profiles",
    ] as const;

    for (const table of tables) {
      // quote_requests uses customer_user_id / pro_user_id rather than user_id.
      if (table === "quote_requests") {
        await supabaseAdmin.from(table).delete().or(
          `customer_user_id.eq.${userId},pro_user_id.eq.${userId}`,
        );
      } else if (table === "profiles") {
        await supabaseAdmin.from(table).delete().eq("id", userId);
      } else {
        await supabaseAdmin.from(table).delete().eq("user_id", userId);
      }
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
