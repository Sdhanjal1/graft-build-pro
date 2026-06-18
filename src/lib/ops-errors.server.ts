import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Best-effort error logger for the /ops dashboard. NEVER throws — wrapping
 * a real failure path in this helper must not turn a recoverable error into
 * a webhook 500 or a user-facing crash.
 */
export async function logErrorEvent(opts: {
  userId?: string | null;
  context: string;
  message: string;
}): Promise<void> {
  try {
    await supabaseAdmin.from("error_events").insert({
      user_id: opts.userId ?? null,
      context: opts.context.slice(0, 200),
      message: (opts.message ?? "").slice(0, 2000),
    });
  } catch (e) {
    // Swallow — logging must never break the caller.
    console.error("[ops-errors] failed to record error event", e);
  }
}
