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

function getSecretForEnv(env: string | null): string | undefined {
  // Live is the fail-safe default (matches getStripeEnv): any value other
  // than the explicit "sandbox" opt-in routes to the live secret.
  if (env === "sandbox") return process.env.STRIPE_CONNECT_SANDBOX_WEBHOOK_SECRET;
  return process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
}

export const Route = createFileRoute("/api/public/payments/connect-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = url.searchParams.get("env");
        const secret = getSecretForEnv(env);
        if (!secret) {
          // No secret configured for this env. Ack 200 so Stripe doesn't
          // retry for 3 days, but log so a silent misconfiguration surfaces
          // in ops instead of vanishing as a console line in a Worker log.
          console.warn("[connect-webhook] no secret configured for env, dropping", env);
          const { logErrorEvent } = await import("@/lib/ops-errors.server");
          await logErrorEvent({
            context: "payments.connect_webhook.no_secret",
            message: `env=${env ?? "?"} — STRIPE_CONNECT_${env === "sandbox" ? "SANDBOX_" : ""}WEBHOOK_SECRET not set`,
          });
          return new Response("ok (env not configured)", { status: 200 });
        }

        const rawBody = await request.text();
        const sig = request.headers.get("stripe-signature");
        if (!verify(rawBody, sig, secret)) {
          console.warn("[connect-webhook] invalid signature");
          const { logErrorEvent } = await import("@/lib/ops-errors.server");
          await logErrorEvent({
            context: "payments.connect_webhook.invalid_signature",
            message: `env=${env ?? "?"}`,
          });
          // Return 401 — Stripe will retry, which is what we want when a
          // signing-secret mismatch is the likely cause. Silent-200 would
          // mask a real misconfiguration the way it just did for QTR-001.
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

        // Payment events on connected accounts (direct charges) land here, not
        // on the platform webhook. Route them through the same shared helpers.
        if (type === "checkout.session.completed" || type === "payment_intent.succeeded") {
          console.log("[connect-webhook]", type, "account:", evt.account);
          await handlePaidEvent(evt);
          return new Response("ok", { status: 200 });
        }
        if (type === "payment_intent.payment_failed" || type === "checkout.session.expired") {
          console.log("[connect-webhook]", type, "account:", evt.account);
          await handleFailedEvent(evt);
          return new Response("ok", { status: 200 });
        }

        return new Response("ok", { status: 200 });
      },
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
