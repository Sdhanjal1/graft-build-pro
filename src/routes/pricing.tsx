import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/MarketingShell";
import { Check, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
  head: () => ({
    meta: [
      { title: "Pricing — Quottr" },
      { name: "description", content: "One simple plan. £29/month after a 14-day free trial. No card required to start. Cancel anytime." },
      { property: "og:title", content: "Pricing — Quottr" },
      { property: "og:description", content: "One price. Everything included. No contracts." },
      { property: "og:url", content: "https://www.quottr.co.uk/pricing" },
    ],
    links: [{ rel: "canonical", href: "https://www.quottr.co.uk/pricing" }],
  }),
});

const features = [
  "Unlimited quotes and invoices",
  "Voice to quote",
  "Site capture mode",
  "WhatsApp send",
  "Branded PDFs with your logo",
  "Customer portal",
  "Auto invoice chasers",
  "Annual service reminders",
  "Card and bank payments",
  "Job diary",
  "Google review requests",
  "Offline mode",
];

function PricingPage() {
  return (
    <MarketingShell>
      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-6xl px-5 py-20 md:py-28 text-center">
          <p className="text-[11px] uppercase tracking-widest text-paper/60 font-semibold">Pricing</p>
          <h1
            className="mt-4 text-5xl md:text-7xl leading-[0.9] text-paper"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            Simple plans. <span className="text-lime">No surprises.</span>
          </h1>
          <p className="mt-5 text-lg text-paper/75 max-w-xl mx-auto">
            One price. Everything included. No contracts.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-5 py-16 -mt-16 md:-mt-20">
        <div className="rounded-3xl bg-paper text-ink border-2 border-ink shadow-[0_30px_60px_-20px_color-mix(in_oklab,var(--ink)_50%,transparent)] p-8 md:p-10">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest font-semibold bg-lime text-ink px-3 py-1 rounded-full">
              Free for 14 days
            </span>
            <span className="text-xs text-ink/60 font-medium">No card required</span>
          </div>

          <div className="mt-7 text-center">
            <div
              className="leading-none"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              <span className="text-7xl md:text-8xl">£29</span>
              <span className="text-2xl md:text-3xl text-ink/60 ml-2">/ month</span>
            </div>
            <p className="mt-3 text-sm text-ink/60">
              Free for 14 days. Then £29/month. Cancel anytime.
            </p>
          </div>

          <div className="mt-8 h-px bg-ink/10" />

          <p className="mt-7 text-[11px] uppercase tracking-widest font-semibold text-ink/60 text-center">
            Everything included
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm">
                <span className="mt-0.5 h-5 w-5 rounded-full bg-lime flex items-center justify-center shrink-0">
                  <Check className="h-3.5 w-3.5 text-ink" strokeWidth={3} />
                </span>
                <span className="text-ink/85">{f}</span>
              </li>
            ))}
          </ul>

          <Link
            to="/auth"
            className="mt-9 w-full inline-flex items-center justify-center gap-2 bg-lime text-ink font-semibold px-6 py-4 rounded-full hover:brightness-95 transition text-base"
          >
            Start free trial — no card needed <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <p className="mt-5 text-center text-xs text-ink/55 max-w-md mx-auto leading-relaxed">
          After your 14 day trial — £29/month. Cancel anytime. No contracts. No per-quote fees. No hidden charges.
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-24">
        <ul className="space-y-3">
          {[
            "No card required to start your free trial",
            "Cancel before 14 days and pay nothing",
            "Everything is included — nothing locked behind upgrades",
          ].map((line) => (
            <li
              key={line}
              className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-card px-5 py-4"
            >
              <span className="h-7 w-7 rounded-full bg-lime flex items-center justify-center shrink-0">
                <Check className="h-4 w-4 text-ink" strokeWidth={3} />
              </span>
              <span className="text-base text-ink/85">{line}</span>
            </li>
          ))}
        </ul>
      </section>
    </MarketingShell>
  );
}
