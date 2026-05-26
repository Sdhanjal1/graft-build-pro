import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Short branded alias for portal links shared via WhatsApp / SMS / email.
// Resolves either:
//   - a client portal_code      -> /portal/c/{code}    (client portal hub)
//   - a quote_portal_tokens.token -> /portal/{token}   (single-quote portal)
// Falls back to the client portal route (which renders a friendly
// "Portal not available" page) when nothing matches.
export const Route = createFileRoute("/q/$code")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const code = params.code;

        const { data: client } = await supabaseAdmin
          .from("clients")
          .select("portal_code")
          .eq("portal_code", code)
          .maybeSingle();

        if (client?.portal_code) {
          return new Response(null, {
            status: 307,
            headers: { Location: `/portal/c/${code}` },
          });
        }

        const { data: token } = await supabaseAdmin
          .from("quote_portal_tokens")
          .select("token")
          .eq("token", code)
          .maybeSingle();

        if (token?.token) {
          return new Response(null, {
            status: 307,
            headers: { Location: `/portal/${code}` },
          });
        }

        return new Response(null, {
          status: 307,
          headers: { Location: `/portal/c/${code}` },
        });
      },
    },
  },
  // SPA fallback (client-side nav lands here without hitting the server handler).
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/portal/c/$code", params: { code: params.code }, replace: true });
  },
});
