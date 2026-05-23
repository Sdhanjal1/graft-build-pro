import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyUser } from "@/lib/push.functions";

// Daily cron: notify pros about clients whose service_due_date is within
// the next 14 days and that we haven't already nudged in the last 30 days.
export const Route = createFileRoute("/api/public/hooks/service-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        const auth = request.headers.get("authorization");
        if (!secret || auth !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }
        const now = new Date();
        const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const { data: clients, error } = await supabaseAdmin
          .from("clients")
          .select("id, user_id, name, service_type, service_due_date, reminder_last_sent_at")
          .not("service_due_date", "is", null)
          .gte("service_due_date", now.toISOString().slice(0, 10))
          .lte("service_due_date", horizon.toISOString().slice(0, 10))
          .eq("portal_active", true);

        if (error) {
          console.error("service-reminders query failed", error);
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        let sent = 0;
        for (const c of clients ?? []) {
          if (c.reminder_last_sent_at && new Date(c.reminder_last_sent_at) > cutoff) continue;
          const due = new Date(c.service_due_date as string);
          const days = Math.max(0, Math.ceil((due.getTime() - now.getTime()) / 86400000));
          try {
            await notifyUser(c.user_id, {
              title: `Service reminder: ${c.name}`,
              body: `${c.service_type ?? "Annual service"} due in ${days} day${days === 1 ? "" : "s"}.`,
              url: `/clients/${c.id}`,
              tag: `svc-reminder-${c.id}`,
            });
            await supabaseAdmin
              .from("clients")
              .update({ reminder_last_sent_at: now.toISOString() })
              .eq("id", c.id);
            sent++;
          } catch (e) {
            console.error("reminder push failed", c.id, e);
          }
        }

        return new Response(
          JSON.stringify({ ok: true, checked: clients?.length ?? 0, sent }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
