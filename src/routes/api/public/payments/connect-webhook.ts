import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { handlePaidEvent, handleFailedEvent } from "@/lib/payments-webhook-shared.server";

// Stripe Connect webhook (platform-level events for connected accounts).
// Secret was captured at integration-time as STRIPE_CONNECT_WEBHOOK_SECRET.
function parseStripeSig(header: string) {
  const parts = header.split(",").map((p) => p.trim());
  let t = "";
  const v1: string[] = [];
  for (const p of parts) {
    const [k, v] = p.split("=");
    if (k === "t") t = v;
    if (k === "v1" && v) v1.push(v);
  }
  return { t, v1 };
}

function verify(rawBody: string, sigHeader: string | null, secret: string) {
  if (!sigHeader) return false;
  const { t, v1 } = parseStripeSig(sigHeader);
  if (!t || v1.length === 0) return false;
  const ts = parseInt(t, 10);
  if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return v1.some((sig) => {
    try {
      return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
    } catch {
      return false;
    }
  });
}

export const Route = createFileRoute("/api/public/payments/connect-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
        if (!secret) return new Response("Server not configured", { status: 500 });

        const rawBody = await request.text();
        const sig = request.headers.get("stripe-signature");
        if (!verify(rawBody, sig, secret)) {
          console.warn("[connect-webhook] invalid signature");
          return new Response("Invalid signature", { status: 401 });
        }

        let evt: any;
        try {
          evt = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const type: string = evt.type ?? "";

        // account.updated fires whenever capability flags change
        // (onboarding completed, requirements satisfied, etc.)
        if (type === "account.updated") {
          const acct = evt.data?.object ?? {};
          const acctId: string | undefined = acct.id;
          const userIdMeta: string | undefined = acct.metadata?.user_id;
          if (!acctId) return new Response("ok", { status: 200 });

          // Find user by metadata, fall back to account id lookup.
          let userId = userIdMeta;
          if (!userId) {
            const { data: row } = await supabaseAdmin
              .from("profiles")
              .select("id")
              .eq("stripe_connect_account_id", acctId)
              .maybeSingle();
            userId = row?.id as string | undefined;
          }
          if (!userId) {
            console.warn("[connect-webhook] account.updated without user", acctId);
            return new Response("ok", { status: 200 });
          }

          await supabaseAdmin
            .from("profiles")
            .update({
              stripe_connect_account_id: acctId,
              stripe_connect_charges_enabled: !!acct.charges_enabled,
              stripe_connect_payouts_enabled: !!acct.payouts_enabled,
            })
            .eq("id", userId);
        }

        return new Response("ok", { status: 200 });
      },
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
