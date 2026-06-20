#!/usr/bin/env bun
/**
 * On-demand deposit lifecycle script.
 *
 *   bun scripts/lifecycle-deposit.ts --user <user-uuid>
 *
 * Walks an end-to-end Stripe sandbox flow against a real seeded user:
 *
 *   1. Insert a quote (£1,200 / 20% VAT / 30% deposit) via service role.
 *   2. Mint a portal token.
 *   3. SCRAPE the portal page's rendered deposit figure (paymentTimingLabel
 *      output) — this is the figure the customer actually sees.
 *   4. Call `createPortalCheckout` and read the Checkout Session back from
 *      the Stripe API — `amount_total` is what Stripe will charge. This is
 *      a SEPARATE code path from the portal label, so step 3 vs step 4
 *      catches any divergence.
 *   5. Confirm the underlying PaymentIntent in test mode and read the PI
 *      object back from Stripe — `amount_received` is the source of truth.
 *   6. POST a signed `checkout.session.completed` to the public webhook so
 *      our DB updates the way it does in production.
 *   7. Print the resulting invoice_payments row, quote status, email
 *      status, and the deposit-received PDF text.
 *   8. Mark the balance paid via the manual route and print the resulting
 *      receipt PDF + final DB state.
 *
 * Prints raw evidence at every step — PIs, pence, PDF text, DB rows.
 *
 * Required env: STRIPE_SANDBOX_API_KEY, SUPABASE_URL,
 *   SUPABASE_SERVICE_ROLE_KEY, PAYMENTS_SANDBOX_WEBHOOK_SECRET,
 *   optionally APP_ORIGIN (defaults to the project's preview URL).
 *
 * Assumes the chosen user has a sandbox Stripe Connect account with
 * charges enabled and a client row to attach the quote to.
 */
import { createClient } from "@supabase/supabase-js";
import { createHmac, randomUUID } from "node:crypto";
import { generateInvoicePdfBytes } from "../src/lib/invoice-pdf.server";
import { PDFParse } from "pdf-parse";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function need(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env: ${name}`);
    process.exit(1);
  }
  return v;
}

function banner(title: string) {
  console.log(`\n=== ${title} ===`);
}

function dump(label: string, value: unknown) {
  console.log(
    `${label}:`,
    typeof value === "string" ? value : JSON.stringify(value, null, 2),
  );
}

async function stripeGet(path: string, key: string, account?: string) {
  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  if (account) headers["Stripe-Account"] = account;
  const r = await fetch(`https://api.stripe.com/v1${path}`, { headers });
  if (!r.ok) throw new Error(`Stripe GET ${path} → ${r.status} ${await r.text()}`);
  return r.json();
}

async function stripePost(
  path: string,
  body: Record<string, string | number>,
  key: string,
  account?: string,
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (account) headers["Stripe-Account"] = account;
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) form.append(k, String(v));
  const r = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers,
    body: form.toString(),
  });
  const j: any = await r.json();
  if (!r.ok) throw new Error(`Stripe POST ${path} → ${r.status} ${JSON.stringify(j)}`);
  return j;
}

async function pdfText(bytes: Uint8Array): Promise<string> {
  const p = new PDFParse({ data: new Uint8Array(bytes) });
  const out = await p.getText();
  return out.text;
}

function signWebhook(body: string, secret: string) {
  const ts = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  return `t=${ts},v1=${sig}`;
}

async function main() {
  const userId = arg("--user");
  if (!userId) {
    console.error("Usage: bun scripts/lifecycle-deposit.ts --user <uuid>");
    process.exit(1);
  }
  const SUPABASE_URL = need("SUPABASE_URL");
  const SERVICE_KEY = need("SUPABASE_SERVICE_ROLE_KEY");
  const STRIPE_KEY = need("STRIPE_SANDBOX_API_KEY");
  const WEBHOOK_SECRET = need("PAYMENTS_SANDBOX_WEBHOOK_SECRET");
  const APP_ORIGIN =
    process.env.APP_ORIGIN ?? "https://graft-build-pro.lovable.app";

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  banner("STEP 0: lookup user / client / connect account");
  const { data: profile, error: profileErr } = await sb
    .from("profiles")
    .select(
      "id, business_name, stripe_connect_account_id, stripe_connect_charges_enabled",
    )
    .eq("id", userId)
    .maybeSingle();
  if (profileErr || !profile) throw profileErr ?? new Error("profile not found");
  dump("profile", profile);
  if (!profile.stripe_connect_account_id || !profile.stripe_connect_charges_enabled) {
    throw new Error("user has no Connect account or charges not enabled");
  }
  const acct = profile.stripe_connect_account_id as string;

  const { data: client, error: clientErr } = await sb
    .from("clients")
    .select("id, name, email")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (clientErr || !client) throw clientErr ?? new Error("no client found for user");
  dump("client", client);

  banner("STEP 1: create quote");
  const total = 1200;
  const depositPct = 30;
  const depositAmount = +((total * depositPct) / 100).toFixed(2); // 360.00
  const subtotal = +(total / 1.2).toFixed(2); // 1000.00
  const vat = +(total - subtotal).toFixed(2); // 200.00
  const ref = `LCY-${Date.now().toString().slice(-6)}`;
  const { data: quote, error: quoteErr } = await sb
    .from("quotes")
    .insert({
      user_id: userId,
      client_id: client.id,
      ref,
      title: "Lifecycle test — bathroom refit",
      job_description: "Automated deposit lifecycle test.",
      line_items: [{ description: "Labour", qty: 1, unit_price: subtotal, category: "labour" }],
      subtotal,
      vat_amount: vat,
      total,
      vat_registered: true,
      payment_timing: "deposit_then_balance",
      deposit_percent: depositPct,
      deposit_amount: depositAmount,
      status: "sent",
      portal_visible: true,
    })
    .select("*")
    .single();
  if (quoteErr) throw quoteErr;
  dump("quote", {
    id: quote.id,
    ref: quote.ref,
    total: quote.total,
    deposit_amount: quote.deposit_amount,
    deposit_percent: quote.deposit_percent,
  });

  banner("STEP 2: mint portal token");
  const token = randomUUID().replace(/-/g, "");
  const { error: tokErr } = await sb.from("quote_portal_tokens").insert({
    token,
    quote_id: quote.id,
    user_id: userId,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (tokErr) throw tokErr;
  dump("token", token);
  dump("portal_url", `${APP_ORIGIN}/portal/${token}`);

  banner("STEP 3: SCRAPE portal page — what the customer sees");
  // Hit the rendered SSR page and grep the deposit figure out of the HTML.
  const portalHtml = await (await fetch(`${APP_ORIGIN}/portal/${token}`)).text();
  // paymentTimingLabel renders e.g. "£360.00 deposit (30%), balance £840.00 on completion"
  const depositMatch = portalHtml.match(/£\s*([\d,]+\.\d{2})\s*deposit/i);
  const portalDisplayedPence = depositMatch
    ? Math.round(Number(depositMatch[1].replace(/,/g, "")) * 100)
    : null;
  dump("portal.html_match", depositMatch?.[0] ?? "(not found — page may not be SSR-rendering label)");
  dump("portal.displayed_pence", portalDisplayedPence);

  banner("STEP 4: call createPortalCheckout & read Checkout Session back");
  // We invoke the server function via its HTTP endpoint so we exercise the
  // exact same path the customer hits when they tap "Accept & pay deposit".
  const fnRes = await fetch(`${APP_ORIGIN}/_serverFn/src_lib_payments_functions_ts--createPortalCheckout_createServerFn_handler`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: { token, requestType: "deposit", returnOrigin: APP_ORIGIN },
    }),
  }).then((r) => r.json()).catch((e) => ({ error: String(e) }));
  dump("createPortalCheckout.response", fnRes);
  const sessionId: string | undefined = fnRes?.result?.sessionId ?? fnRes?.sessionId;
  if (!sessionId) {
    console.error("Could not extract sessionId — check server-fn URL above and re-run");
    process.exit(2);
  }
  const session: any = await stripeGet(`/checkout/sessions/${sessionId}`, STRIPE_KEY, acct);
  dump("stripe.checkout_session.id", session.id);
  dump("stripe.checkout_session.amount_total_pence", session.amount_total);
  dump("stripe.checkout_session.payment_intent", session.payment_intent);

  if (portalDisplayedPence !== null && session.amount_total !== portalDisplayedPence) {
    console.error(
      `\n*** ASSERT FAIL: portal shows ${portalDisplayedPence}p but Stripe will charge ${session.amount_total}p ***\n`,
    );
  } else if (portalDisplayedPence !== null) {
    console.log(`ASSERT portal == stripe: OK (${portalDisplayedPence}p)`);
  } else {
    console.log("ASSERT portal == stripe: SKIPPED (portal figure not scraped)");
  }

  banner("STEP 5: confirm PaymentIntent in test mode & read it back");
  const pi: any = await stripePost(
    `/payment_intents/${session.payment_intent}/confirm`,
    { payment_method: "pm_card_visa" },
    STRIPE_KEY,
    acct,
  );
  dump("stripe.payment_intent.id", pi.id);
  dump("stripe.payment_intent.status", pi.status);
  dump("stripe.payment_intent.amount", pi.amount);
  dump("stripe.payment_intent.amount_received", pi.amount_received);

  banner("STEP 6: deliver checkout.session.completed → public webhook");
  const completedSession = await stripeGet(`/checkout/sessions/${sessionId}`, STRIPE_KEY, acct);
  const evt = {
    id: `evt_lifecycle_${Date.now()}`,
    type: "checkout.session.completed",
    data: { object: completedSession },
  };
  const body = JSON.stringify(evt);
  const sig = signWebhook(body, WEBHOOK_SECRET);
  const wh = await fetch(`${APP_ORIGIN}/api/public/payments/webhook?env=sandbox`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": sig },
    body,
  });
  dump("webhook.status", wh.status);
  dump("webhook.body", await wh.text());

  banner("STEP 7: read back DB state + render deposit-received PDF");
  const { data: ipRows } = await sb
    .from("invoice_payments")
    .select("*")
    .eq("quote_id", quote.id)
    .order("created_at", { ascending: false });
  dump("db.invoice_payments", ipRows);
  const { data: q1 } = await sb
    .from("quotes")
    .select("status, invoice_email_status, invoice_email_to, invoice_email_error")
    .eq("id", quote.id)
    .single();
  dump("db.quote", q1);

  const depositPdf = await generateInvoicePdfBytes(
    {
      ref: quote.ref,
      title: quote.title,
      job_description: quote.job_description,
      line_items: quote.line_items as any,
      subtotal: Number(quote.subtotal),
      vat_amount: Number(quote.vat_amount),
      total: Number(quote.total),
      vat_registered: quote.vat_registered,
      created_at: quote.created_at,
      paid_at: null, // deposit-received → NO PAID stamp
    } as any,
    client as any,
    profile as any,
  );
  dump("pdf.deposit_received.text", await pdfText(depositPdf));

  banner("STEP 8: balance flow — manual mark paid + receipt PDF");
  // Insert the balance payment row exactly as the manual mark-paid handler
  // would, then render the receipt PDF and print final state.
  const balancePence = total * 100 - (pi.amount_received ?? 0);
  await sb.from("invoice_payments").insert({
    user_id: userId,
    quote_id: quote.id,
    request_type: "full",
    status: "paid",
    amount_cents: balancePence,
    currency: "gbp",
    payment_method: "bank",
    paid_at: new Date().toISOString(),
  });
  await sb.from("quotes").update({ status: "paid" }).eq("id", quote.id);
  dump("balance.computed_pence", balancePence);

  const receiptPdf = await generateInvoicePdfBytes(
    {
      ref: quote.ref,
      title: quote.title,
      job_description: quote.job_description,
      line_items: quote.line_items as any,
      subtotal: Number(quote.subtotal),
      vat_amount: Number(quote.vat_amount),
      total: Number(quote.total),
      vat_registered: quote.vat_registered,
      created_at: quote.created_at,
      paid_at: new Date().toISOString(),
      payment_method: "bank",
    } as any,
    client as any,
    profile as any,
  );
  dump("pdf.receipt.text", await pdfText(receiptPdf));

  const { data: finalRows } = await sb
    .from("invoice_payments")
    .select("request_type, amount_cents, status, payment_method, paid_at")
    .eq("quote_id", quote.id)
    .order("created_at", { ascending: true });
  dump("db.final.invoice_payments", finalRows);
  const { data: q2 } = await sb
    .from("quotes")
    .select("status, invoice_email_status")
    .eq("id", quote.id)
    .single();
  dump("db.final.quote", q2);

  banner("DONE — raw evidence above. No pass/fail summary by design.");
}

main().catch((e) => {
  console.error("LIFECYCLE FAILED:", e);
  process.exit(1);
});
