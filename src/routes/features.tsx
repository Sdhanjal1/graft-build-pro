import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/MarketingShell";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/features")({
  component: FeaturesPage,
  head: () => ({
    meta: [
      { title: "Features, Quottr" },
      { name: "description", content: "Voice quoting, WhatsApp send, a customer portal, in-app payments and automatic chasers. Everything Quottr does for tradespeople." },
      { property: "og:title", content: "Features, Quottr" },
      { property: "og:description", content: "Voice to quote, WhatsApp send, customer portal, instant payments and auto chasers, built for tradespeople." },
      { property: "og:url", content: "https://www.quottr.co.uk/features" },
    ],
    links: [{ rel: "canonical", href: "https://www.quottr.co.uk/features" }],
  }),
});

const features = [
  { kicker: "Voice", title: "Voice to quote", body: "Mumble the line items into your phone. Get a priced, branded quote back in seconds." },
  { kicker: "Send", title: "WhatsApp it over", body: "One tap opens WhatsApp with a written message and your customer's private portal link." },
  { kicker: "Portal", title: "Every customer gets a portal", body: "A private link to view their quotes, invoices and certificates, approve the job, and pay. No chasing calls." },
  { kicker: "Branding", title: "Quotes that look the part", body: "Your logo, your colours, every time. Looks like you spent two grand on a brand designer." },
  { kicker: "Payments", title: "Get paid in the app", body: "Card, bank transfer or Apple Pay. The money lands in your account, not next month." },
  { kicker: "Auto-chase", title: "Chases the money for you", body: "Polite reminders go out at day 7, 14 and 21, automatically. You never have to ask twice." },
  { kicker: "Accounting", title: "Your books, already sorted", body: "Export paid invoices as a CSV formatted for Xero, QuickBooks, FreeAgent or Sage, with the right VAT codes. No re-typing.", wide: true },
];


function FeaturesPage() {
  return (
    <MarketingShell>
      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-6xl px-5 md:px-8 py-20 md:py-28">
          <h1 className="text-5xl md:text-7xl leading-[0.95] text-paper max-w-3xl" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            Everything you need. <span className="text-lime">Nothing you don't.</span>
          </h1>
          <p className="mt-5 text-lg text-paper/75 max-w-2xl">
            Quottr replaces three apps, a notebook and a stack of Post-its. Here's the lot.
          </p>

          <div className="mt-14 grid gap-px bg-paper/10 md:grid-cols-3 rounded-3xl overflow-hidden">
            {features.map((f) => (
              <div key={f.title} className={`bg-ink p-8 ${f.wide ? "md:col-span-3" : ""}`}>
                <span className="text-[11px] uppercase tracking-[0.2em] font-bold text-lime">{f.kicker}</span>
                <h3 className="mt-4 text-2xl md:text-3xl text-paper leading-[0.95]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{f.title}</h3>
                <p className="mt-3 text-paper/70 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-12">
            <Link to="/auth" className="inline-flex items-center gap-2 bg-lime text-ink font-bold px-7 py-4 rounded-full hover:brightness-95 transition">
              Start quoting free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
