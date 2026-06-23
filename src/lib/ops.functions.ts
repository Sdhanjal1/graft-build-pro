import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MONTHLY_PRICE_PENCE = 3499;

export const getIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ isAdmin: boolean }> => {
    const { data, error } = await context.supabase.rpc("is_admin", {
      _uid: context.userId,
    });
    if (error) return { isAdmin: false };
    return { isAdmin: Boolean(data) };
  });

export type ConnectClientIdCheck = {
  ok: boolean;
  mode: "live" | "mismatch" | "unknown";
  httpStatus: number;
  stripeError?: string;
  stripeErrorType?: string;
  message: string;
  clientIdPresent: boolean;
  liveKeyPresent: boolean;
};

/**
 * Admin-only: ask Stripe whether STRIPE_CONNECT_CLIENT_ID belongs to the same
 * platform account as our live secret key. We POST to the OAuth deauthorize
 * endpoint with a definitely-non-existent stripe_user_id:
 *
 *  - Live id + live key   → 400 invalid_request (account not found) → MATCH
 *  - Wrong id / wrong env → 401 invalid_client  (no such application) → MISMATCH
 *
 * The probe never mutates anything — deauthorize on a fake account is a no-op.
 */
export const verifyConnectClientId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConnectClientIdCheck> => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", {
      _uid: context.userId,
    });
    if (!isAdmin) throw new Error("Forbidden");

    const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
    const liveKey = process.env.STRIPE_BYOK_SECRET_KEY;
    const clientIdPresent = !!clientId;
    const liveKeyPresent = !!liveKey;

    if (!clientId || !liveKey) {
      return {
        ok: false,
        mode: "unknown",
        httpStatus: 0,
        message: !clientId
          ? "STRIPE_CONNECT_CLIENT_ID is not set"
          : "STRIPE_BYOK_SECRET_KEY (live) is not set",
        clientIdPresent,
        liveKeyPresent,
      };
    }

    const body = new URLSearchParams({
      client_id: clientId,
      stripe_user_id: "acct_lovable_probe_does_not_exist",
    });

    let res: Response;
    try {
      res = await fetch("https://connect.stripe.com/oauth/deauthorize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${liveKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        signal: AbortSignal.timeout(15_000),
      });
    } catch (e) {
      return {
        ok: false,
        mode: "unknown",
        httpStatus: 0,
        message: `Network error reaching Stripe: ${e instanceof Error ? e.message : String(e)}`,
        clientIdPresent,
        liveKeyPresent,
      };
    }

    const text = await res.text();
    let parsed: { error?: string; error_description?: string } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      // leave parsed empty; fall through to raw text
    }
    const stripeError = parsed.error_description ?? text.slice(0, 300);
    const stripeErrorType = parsed.error;

    // Match: Stripe accepted the client_id + key pair but the account doesn't exist.
    if (res.status === 400 && stripeErrorType === "invalid_request") {
      return {
        ok: true,
        mode: "live",
        httpStatus: res.status,
        stripeError,
        stripeErrorType,
        message: "Live match — client id is on the live platform account.",
        clientIdPresent,
        liveKeyPresent,
      };
    }

    // Mismatch: client id is unknown to this account (wrong env or wrong platform).
    if (res.status === 401 || stripeErrorType === "invalid_client") {
      return {
        ok: false,
        mode: "mismatch",
        httpStatus: res.status,
        stripeError,
        stripeErrorType,
        message:
          "Mismatch — Stripe doesn't recognise this client id on the live platform. Update STRIPE_CONNECT_CLIENT_ID to the live ca_… from Stripe → Settings → Connect → Onboarding options.",
        clientIdPresent,
        liveKeyPresent,
      };
    }

    return {
      ok: false,
      mode: "unknown",
      httpStatus: res.status,
      stripeError,
      stripeErrorType,
      message: `Inconclusive — Stripe returned ${res.status} ${stripeErrorType ?? ""}: ${stripeError}`,
      clientIdPresent,
      liveKeyPresent,
    };
  });

export type OpsDashboard = {
  generatedAt: string;
  revenue: {
    mrrPence: number;
    activeCount: number;
    trialingCount: number;
    pastDueCount: number;
    canceledCount: number;
    trialToPaidPct: number | null;
    trialEndedTotal: number;
    trialConverted: number;
    platformFeesPence: number;
    feesPartlyEstimated: boolean;
    totalRevenuePence: number;
  };
  gmv: {
    totalPence: number;
    last7dPence: number;
    last30dPence: number;
    paidPaymentsCount: number;
    distinctTraders: number;
    avgPaymentPence: number;
    paymentsPerActiveTrader: number;
  };
  activation: {
    signupsTotal: number;
    signupsLast7d: number;
    signupsLast30d: number;
    activatedCount: number; // users with >= 1 quote
    activationRatePct: number | null;
    firstQuoteWithin24hPct: number | null;
    firstQuoteWithin24hCount: number;
    quoteFunnel: { draft: number; sent: number; accepted: number; paid: number };
  };
  health: {
    pastDueSubs: number;
    failedPayments: number;
    stuckConnect: number;
    coldLeads: number;
  };
  recentErrors: Array<{
    id: string;
    createdAt: string;
    context: string;
    message: string;
    userLabel: string | null;
  }>;
  recentSignups: Array<{
    id: string;
    createdAt: string;
    businessName: string | null;
    trade: string | null;
    email: string | null;
    hasSentQuote: boolean;
  }>;
};

export const getOpsDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OpsDashboard> => {
    // Server-side admin gate — the route's beforeLoad redirect is UX only.
    const { data: adminOk, error: adminErr } = await context.supabase.rpc("is_admin", {
      _uid: context.userId,
    });
    if (adminErr || !adminOk) {
      throw new Error("Forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();
    const iso7 = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
    const iso30 = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();
    const nowIso = now.toISOString();

    // ============ REVENUE ============
    const subsP = supabaseAdmin
      .from("subscriptions")
      .select("status, trial_end, environment");

    // ============ GMV ============
    const paidPaymentsP = supabaseAdmin
      .from("invoice_payments")
      .select("user_id, amount_cents, platform_fee_cents, paid_at, status")
      .eq("status", "paid");

    const failedPaymentsP = supabaseAdmin
      .from("invoice_payments")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed");

    // ============ ACTIVATION ============
    const profilesP = supabaseAdmin
      .from("profiles")
      .select("id, created_at, business_name, trade_type, email, stripe_connect_account_id, stripe_connect_charges_enabled");

    const quotesAllP = supabaseAdmin
      .from("quotes")
      .select("user_id, status, created_at");

    // ============ HEALTH ============
    const coldLeadsP = supabaseAdmin
      .from("quote_requests")
      .select("id", { count: "exact", head: true })
      .is("read_at", null);

    // ============ Recent feeds ============
    const recentErrorsP = supabaseAdmin
      .from("error_events")
      .select("id, created_at, context, message, user_id")
      .order("created_at", { ascending: false })
      .limit(20);

    const recentSignupsP = supabaseAdmin
      .from("profiles")
      .select("id, created_at, business_name, trade_type, email")
      .order("created_at", { ascending: false })
      .limit(20);

    const [
      subsRes,
      paidPaymentsRes,
      failedPaymentsRes,
      profilesRes,
      quotesAllRes,
      coldLeadsRes,
      recentErrorsRes,
      recentSignupsRes,
    ] = await Promise.all([
      subsP,
      paidPaymentsP,
      failedPaymentsP,
      profilesP,
      quotesAllP,
      coldLeadsP,
      recentErrorsP,
      recentSignupsP,
    ]);

    // --- Revenue calc ---
    const subs = (subsRes.data ?? []).filter((s: any) => (s.environment ?? "live") === "live");
    const activeCount = subs.filter((s: any) => s.status === "active").length;
    const trialingCount = subs.filter((s: any) => s.status === "trialing").length;
    const pastDueCount = subs.filter((s: any) => s.status === "past_due").length;
    const canceledCount = subs.filter((s: any) => s.status === "canceled" || s.status === "cancelled").length;

    const trialEnded = subs.filter(
      (s: any) => s.trial_end && new Date(s.trial_end).toISOString() < nowIso,
    );
    const trialConverted = trialEnded.filter(
      (s: any) => s.status === "active" || s.status === "past_due" || s.status === "canceled" || s.status === "cancelled",
    ).length;
    const trialToPaidPct =
      trialEnded.length === 0 ? null : (trialConverted / trialEnded.length) * 100;

    const paidPayments = paidPaymentsRes.data ?? [];
    let platformFeesPence = 0;
    let feesPartlyEstimated = false;
    for (const p of paidPayments as any[]) {
      if (typeof p.platform_fee_cents === "number") {
        platformFeesPence += p.platform_fee_cents;
      } else {
        platformFeesPence += Math.round((p.amount_cents ?? 0) * 0.005);
        feesPartlyEstimated = true;
      }
    }
    const mrrPence = activeCount * MONTHLY_PRICE_PENCE;
    const totalRevenuePence = mrrPence + platformFeesPence;

    // --- GMV calc ---
    let totalGmv = 0;
    let gmv7 = 0;
    let gmv30 = 0;
    const traderSet = new Set<string>();
    for (const p of paidPayments as any[]) {
      const amt = p.amount_cents ?? 0;
      totalGmv += amt;
      if (p.paid_at && p.paid_at >= iso30) gmv30 += amt;
      if (p.paid_at && p.paid_at >= iso7) gmv7 += amt;
      if (p.user_id) traderSet.add(p.user_id);
    }
    const paidCount = paidPayments.length;
    const avgPaymentPence = paidCount > 0 ? Math.round(totalGmv / paidCount) : 0;
    const paymentsPerActiveTrader =
      traderSet.size > 0 ? Math.round((paidCount / traderSet.size) * 10) / 10 : 0;

    // --- Activation calc ---
    const profiles = (profilesRes.data ?? []) as any[];
    const signupsTotal = profiles.length;
    const signupsLast7d = profiles.filter((p) => p.created_at >= iso7).length;
    const signupsLast30d = profiles.filter((p) => p.created_at >= iso30).length;

    const quotesAll = (quotesAllRes.data ?? []) as any[];
    const firstQuoteByUser = new Map<string, string>(); // userId -> earliest ISO
    for (const q of quotesAll) {
      if (!q.user_id || !q.created_at) continue;
      const cur = firstQuoteByUser.get(q.user_id);
      if (!cur || q.created_at < cur) firstQuoteByUser.set(q.user_id, q.created_at);
    }
    const activatedCount = firstQuoteByUser.size;
    const activationRatePct =
      signupsTotal > 0 ? (activatedCount / signupsTotal) * 100 : null;

    let firstQuoteWithin24hCount = 0;
    for (const p of profiles) {
      const firstQ = firstQuoteByUser.get(p.id);
      if (!firstQ) continue;
      const diffMs = new Date(firstQ).getTime() - new Date(p.created_at).getTime();
      if (diffMs >= 0 && diffMs <= 24 * 3600 * 1000) firstQuoteWithin24hCount += 1;
    }
    const firstQuoteWithin24hPct =
      signupsTotal > 0 ? (firstQuoteWithin24hCount / signupsTotal) * 100 : null;

    // Quote funnel
    let qDraft = 0, qSent = 0, qAccepted = 0, qPaid = 0;
    for (const q of quotesAll) {
      switch (q.status) {
        case "pending":
        case "draft":
          qDraft += 1; break;
        case "sent":
        case "overdue":
          qSent += 1; break;
        case "accepted":
        case "completed":
          qAccepted += 1; break;
        case "paid":
          qPaid += 1; break;
      }
    }

    // --- Health ---
    const stuckConnect = profiles.filter(
      (p) => p.stripe_connect_account_id && !p.stripe_connect_charges_enabled,
    ).length;

    // --- Recent errors with user label ---
    const errs = (recentErrorsRes.data ?? []) as any[];
    const profileById = new Map(profiles.map((p) => [p.id, p]));
    const recentErrors = errs.map((e) => {
      const p = e.user_id ? profileById.get(e.user_id) : null;
      const label = p
        ? (p as any).business_name || (p as any).email || ((e.user_id as string) ?? "").slice(0, 8)
        : e.user_id
          ? (e.user_id as string).slice(0, 8)
          : null;
      return {
        id: e.id,
        createdAt: e.created_at,
        context: e.context,
        message: e.message,
        userLabel: label,
      };
    });

    // --- Recent signups ---
    const sentQuoteStatuses = new Set(["sent", "accepted", "completed", "paid", "overdue"]);
    const userHasSentQuote = new Set<string>();
    for (const q of quotesAll) {
      if (q.user_id && sentQuoteStatuses.has(q.status)) userHasSentQuote.add(q.user_id);
    }
    const recentSignups = ((recentSignupsRes.data ?? []) as any[]).map((p) => ({
      id: p.id,
      createdAt: p.created_at,
      businessName: p.business_name ?? null,
      trade: p.trade_type ?? null,
      email: p.email ?? null,
      hasSentQuote: userHasSentQuote.has(p.id),
    }));

    return {
      generatedAt: nowIso,
      revenue: {
        mrrPence,
        activeCount,
        trialingCount,
        pastDueCount,
        canceledCount,
        trialToPaidPct,
        trialEndedTotal: trialEnded.length,
        trialConverted,
        platformFeesPence,
        feesPartlyEstimated,
        totalRevenuePence,
      },
      gmv: {
        totalPence: totalGmv,
        last7dPence: gmv7,
        last30dPence: gmv30,
        paidPaymentsCount: paidCount,
        distinctTraders: traderSet.size,
        avgPaymentPence,
        paymentsPerActiveTrader,
      },
      activation: {
        signupsTotal,
        signupsLast7d,
        signupsLast30d,
        activatedCount,
        activationRatePct,
        firstQuoteWithin24hPct,
        firstQuoteWithin24hCount,
        quoteFunnel: { draft: qDraft, sent: qSent, accepted: qAccepted, paid: qPaid },
      },
      health: {
        pastDueSubs: pastDueCount,
        failedPayments: failedPaymentsRes.count ?? 0,
        stuckConnect,
        coldLeads: coldLeadsRes.count ?? 0,
      },
      recentErrors,
      recentSignups,
    };
  });

// ============================================================
// Stack health — admin-only live probes for every external dep
// ============================================================

export type StackProbeStatus = "ok" | "degraded" | "down" | "unknown";

export type StackProbe = {
  id: string;
  service: string;
  category: "AI" | "Payments" | "Email" | "Push" | "Infra";
  status: StackProbeStatus;
  message: string;
  httpStatus?: number;
  latencyMs?: number;
  topUpUrl?: string;
  secretName?: string;
  docsAnchor: string;
};

export type StackHealth = {
  generatedAt: string;
  probes: StackProbe[];
};

async function probe(
  base: Omit<StackProbe, "status" | "message" | "httpStatus" | "latencyMs">,
  run: () => Promise<{ status: StackProbeStatus; message: string; httpStatus?: number }>,
): Promise<StackProbe> {
  const t0 = Date.now();
  try {
    const r = await run();
    return { ...base, ...r, latencyMs: Date.now() - t0 };
  } catch (e) {
    return {
      ...base,
      status: "down",
      message: e instanceof Error ? e.message : String(e),
      latencyMs: Date.now() - t0,
    };
  }
}

const TIMEOUT_MS = 4000;

async function fetchWithTimeout(url: string, init?: RequestInit) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
}

export const getStackHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StackHealth> => {
    const { data: adminOk } = await context.supabase.rpc("is_admin", {
      _uid: context.userId,
    });
    if (!adminOk) throw new Error("Forbidden");

    const probes = await Promise.all([
      // ---- AI ----
      probe(
        {
          id: "anthropic",
          service: "Anthropic (Claude)",
          category: "AI",
          secretName: "ANTHROPIC_API_KEY",
          topUpUrl: "https://console.anthropic.com/settings/billing",
          docsAnchor: "anthropic-claude",
        },
        async () => {
          const key = process.env.ANTHROPIC_API_KEY;
          if (!key) return { status: "unknown", message: "ANTHROPIC_API_KEY not set" };
          const r = await fetchWithTimeout("https://api.anthropic.com/v1/models", {
            headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
          });
          const body = await r.text();
          if (r.ok) return { status: "ok", message: "API key valid, models reachable", httpStatus: r.status };
          if (/credit balance/i.test(body))
            return { status: "down", message: "Credit balance too low — top up", httpStatus: r.status };
          if (r.status === 401)
            return { status: "down", message: "Invalid API key (401)", httpStatus: r.status };
          return { status: "degraded", message: body.slice(0, 200), httpStatus: r.status };
        },
      ),
      probe(
        {
          id: "openai",
          service: "OpenAI (Whisper)",
          category: "AI",
          secretName: "OPENAI_API_KEY",
          topUpUrl: "https://platform.openai.com/account/billing",
          docsAnchor: "openai-whisper",
        },
        async () => {
          const key = process.env.OPENAI_API_KEY;
          if (!key) return { status: "unknown", message: "OPENAI_API_KEY not set" };
          const r = await fetchWithTimeout("https://api.openai.com/v1/models", {
            headers: { Authorization: `Bearer ${key}` },
          });
          const body = await r.text();
          if (r.ok) return { status: "ok", message: "API key valid", httpStatus: r.status };
          if (/insufficient_quota/i.test(body))
            return { status: "down", message: "Quota exhausted — top up", httpStatus: r.status };
          if (r.status === 401)
            return { status: "down", message: "Invalid API key (401)", httpStatus: r.status };
          return { status: "degraded", message: body.slice(0, 200), httpStatus: r.status };
        },
      ),
      probe(
        {
          id: "lovable-ai",
          service: "Lovable AI Gateway",
          category: "AI",
          secretName: "LOVABLE_API_KEY",
          topUpUrl: "https://lovable.dev/settings/plans",
          docsAnchor: "lovable-ai-gateway",
        },
        async () => {
          const key = process.env.LOVABLE_API_KEY;
          if (!key) return { status: "unknown", message: "LOVABLE_API_KEY not set" };
          const r = await fetchWithTimeout("https://ai.gateway.lovable.dev/v1/models", {
            headers: { "Lovable-API-Key": key },
          });
          if (r.ok) return { status: "ok", message: "Gateway reachable", httpStatus: r.status };
          if (r.status === 402)
            return { status: "down", message: "Credits exhausted (402)", httpStatus: r.status };
          if (r.status === 429)
            return { status: "degraded", message: "Rate limited (429)", httpStatus: r.status };
          return { status: "degraded", message: `HTTP ${r.status}`, httpStatus: r.status };
        },
      ),

      // ---- Payments ----
      probe(
        {
          id: "stripe-live",
          service: "Stripe (live)",
          category: "Payments",
          secretName: "STRIPE_LIVE_API_KEY",
          topUpUrl: "https://dashboard.stripe.com",
          docsAnchor: "stripe--subscriptions-quottr-revenue",
        },
        async () => {
          const key = process.env.STRIPE_LIVE_API_KEY;
          if (!key) return { status: "unknown", message: "STRIPE_LIVE_API_KEY not set" };
          const r = await fetchWithTimeout("https://api.stripe.com/v1/balance", {
            headers: { Authorization: `Bearer ${key}` },
          });
          if (r.ok) return { status: "ok", message: "Live key valid", httpStatus: r.status };
          if (r.status === 401)
            return { status: "down", message: "Invalid live key (401)", httpStatus: r.status };
          return { status: "degraded", message: `HTTP ${r.status}`, httpStatus: r.status };
        },
      ),
      probe(
        {
          id: "stripe-connect",
          service: "Stripe Connect (platform)",
          category: "Payments",
          secretName: "STRIPE_BYOK_SECRET_KEY",
          topUpUrl: "https://dashboard.stripe.com/settings/connect",
          docsAnchor: "stripe-connect-trader-invoice-payments",
        },
        async () => {
          const key = process.env.STRIPE_BYOK_SECRET_KEY;
          const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
          if (!key || !clientId)
            return {
              status: "unknown",
              message: `Missing ${!key ? "STRIPE_BYOK_SECRET_KEY" : "STRIPE_CONNECT_CLIENT_ID"}`,
            };
          const r = await fetchWithTimeout("https://api.stripe.com/v1/balance", {
            headers: { Authorization: `Bearer ${key}` },
          });
          if (r.ok) return { status: "ok", message: "Platform key valid", httpStatus: r.status };
          if (r.status === 401)
            return { status: "down", message: "Invalid platform key (401)", httpStatus: r.status };
          return { status: "degraded", message: `HTTP ${r.status}`, httpStatus: r.status };
        },
      ),

      // ---- Email ----
      probe(
        {
          id: "resend",
          service: "Resend",
          category: "Email",
          secretName: "RESEND_API_KEY",
          topUpUrl: "https://resend.com/settings/billing",
          docsAnchor: "resend",
        },
        async () => {
          const key = process.env.RESEND_API_KEY;
          if (!key) return { status: "unknown", message: "RESEND_API_KEY not set" };
          const r = await fetchWithTimeout("https://api.resend.com/domains", {
            headers: { Authorization: `Bearer ${key}` },
          });
          if (r.ok) return { status: "ok", message: "API key valid", httpStatus: r.status };
          if (r.status === 401 || r.status === 403)
            return { status: "down", message: `Auth failed (${r.status})`, httpStatus: r.status };
          return { status: "degraded", message: `HTTP ${r.status}`, httpStatus: r.status };
        },
      ),

      // ---- Push ----
      probe(
        {
          id: "vapid",
          service: "Web Push (VAPID)",
          category: "Push",
          secretName: "VAPID_PRIVATE_KEY",
          docsAnchor: "web-push-vapid",
        },
        async () => {
          const ok =
            !!process.env.VAPID_PUBLIC_KEY &&
            !!process.env.VAPID_PRIVATE_KEY &&
            !!process.env.VAPID_SUBJECT;
          return ok
            ? { status: "ok", message: "All 3 VAPID env vars set" }
            : { status: "down", message: "Missing VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT" };
        },
      ),

      // ---- Infra ----
      probe(
        {
          id: "supabase",
          service: "Lovable Cloud (Supabase)",
          category: "Infra",
          secretName: "SUPABASE_SERVICE_ROLE_KEY",
          docsAnchor: "lovable-cloud-supabase",
        },
        async () => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.from("profiles").select("id", { head: true, count: "exact" }).limit(1);
          if (error) return { status: "down", message: error.message };
          return { status: "ok", message: "DB reachable via service role" };
        },
      ),
    ]);

    return { generatedAt: new Date().toISOString(), probes };
  });

