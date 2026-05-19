import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/MarketingShell";
import { Check } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
  head: () => ({
    meta: [
      { title: "Pricing — Quottr" },
      { name: "description", content: "Simple, honest pricing for tradespeople. One flat monthly fee, cancel any time." },
      { property: "og:title", content: "Pricing — Quottr" },
      { property: "og:description", content: "Simple monthly pricing. No contracts, no per-quote fees." },
      { property: "og:url", content: "https://graft-build-pro.lovable.app/pricing" },
    ],
    links: [{ rel: "canonical", href: "https://graft-build-pro.lovable.app/pricing" }],
  }),
});

const plans = [
  {
    name: "Solo",
    price: "£14",
    tagline: "For sole traders getting set up.",
    features: ["Unlimited quotes & invoices", "Voice + site capture", "Branded PDFs", "Card & bank payments", "Email support"],
  },
  {
    name: "Crew",
    price: "£29",
    tagline: "For small teams and growing trades.",
    highlight: true,
    features: ["Everything in Solo", "Up to 5 users", "Annual service reminders", "Auto invoice chasers", "Priority support"],
  },
  {
    name: "Yard",
    price: "Custom",
    tagline: "For larger contractors and multi-van outfits.",
    features: ["Everything in Crew", "Unlimited users", "Dedicated account manager", "Onboarding & training", "Custom integrations"],
  },
];

function PricingPage() {
  return (
    <MarketingShell>
      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-6xl px-5 py-20 text-center">
          <p className="text-[11px] uppercase tracking-widest text-paper/60 font-semibold">Pricing</p>
          <h1 className="mt-3 text-5xl md:text-6xl text-paper">Simple plans. No surprises.</h1>
          <p className="mt-4 text-paper/70 max-w-xl mx-auto">One flat monthly fee. No per-quote charges, no contracts. 14-day free trial on every plan.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 -mt-10">
        <div className="grid gap-5 md:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`rounded-3xl p-7 flex flex-col ${
                p.highlight
                  ? "bg-lime text-ink border-2 border-ink shadow-[0_10px_40px_-10px_color-mix(in_oklab,var(--ink)_30%,transparent)]"
                  : "bg-card text-ink border border-ink/10"
              }`}
            >
              {p.highlight && (
                <span className="self-start text-[10px] uppercase tracking-widest font-semibold bg-ink text-paper px-2.5 py-1 rounded-full mb-4">
                  Most popular
                </span>
              )}
              <h3 className="text-3xl">{p.name}</h3>
              <p className="mt-1 text-sm opacity-70">{p.tagline}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-5xl">{p.price}</span>
                {p.price !== "Custom" && <span className="text-sm opacity-60">/ month</span>}
              </div>
              <ul className="mt-6 space-y-3 text-sm flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/auth"
                className={`mt-7 inline-flex items-center justify-center font-semibold px-5 py-3 rounded-full transition ${
                  p.highlight ? "bg-ink text-paper hover:bg-ink/90" : "bg-ink text-paper hover:bg-ink/90"
                }`}
              >
                {p.price === "Custom" ? "Contact sales" : "Start free trial"}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-24">
        <h2 className="text-3xl md:text-4xl text-center">Common questions</h2>
        <div className="mt-8 divide-y divide-ink/10 border-y border-ink/10">
          {[
            { q: "Is there really a free trial?", a: "Yes — 14 days, no card required. After that, pick a plan or walk away." },
            { q: "Are there per-quote fees?", a: "Never. Send as many quotes and invoices as you like on any plan." },
            { q: "What payment methods do clients have?", a: "Card, Apple Pay, Google Pay and bank transfer — all in-app." },
            { q: "Can I cancel any time?", a: "Yes. One click, no phone call, no awkward chat." },
          ].map((item) => (
            <details key={item.q} className="py-5 group">
              <summary className="cursor-pointer list-none flex justify-between items-center font-medium">
                {item.q}
                <span className="text-ink/40 group-open:rotate-45 transition-transform text-xl leading-none">+</span>
              </summary>
              <p className="mt-3 text-sm text-ink/70">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
