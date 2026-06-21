import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/MarketingShell";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/faqs")({
  component: FaqsPage,
  head: () => ({
    meta: [
      { title: "FAQs, Quottr" },
      { name: "description", content: "Common questions about Quottr, pricing, voice quoting, payments, data and more." },
      { property: "og:title", content: "FAQs, Quottr" },
      { property: "og:description", content: "Everything you wanted to ask about Quottr." },
      { property: "og:url", content: "https://www.quottr.co.uk/faqs" },
    ],
    links: [{ rel: "canonical", href: "https://www.quottr.co.uk/faqs" }],
  }),
});

const faqs = [
  { q: "Do I need to type anything?", a: "Nope. Talk to Quottr like you'd talk to your apprentice. We turn your voice note into a priced, branded quote." },
  { q: "What does it cost?", a: "Free for 14 days, no card needed. After that, one flat subscription, see the Pricing page for current rates." },
  { q: "How do customers pay?", a: "Card, Apple Pay, Google Pay or bank transfer. Deposits land in your account, not next month." },
  { q: "Will it work in a loft / cellar / no-signal site?", a: "Creating a voice quote needs a signal — Quottr transcribes in the cloud — but it only takes a few seconds, so step to the doorway or the van and you're sorted in no time." },
  { q: "Can I use my own branding?", a: "Yes, logo, colours, business details, VAT number. Quotes look like you, not us." },
  { q: "Does it integrate with my accounting?", a: "Yes. From Settings you can export your paid invoices as a CSV formatted for Xero, QuickBooks, FreeAgent or Sage, with the right VAT codes and your nominal codes, by tax year or a custom range." },
  { q: "What about chasing late payers?", a: "Quottr nudges them at day 7, 14 and 21 with polite, on-brand reminders. You never have to send 'just chasing this' again." },
  { q: "Is my data safe?", a: "Yes. It's encrypted in transit and at rest, hosted in the EU, and it stays yours." },
];

function FaqsPage() {
  return (
    <MarketingShell>
      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
          <p className="text-[11px] uppercase tracking-widest text-paper/50 font-semibold">FAQs</p>
          <h1 className="mt-3 text-5xl md:text-7xl leading-[0.95] text-paper max-w-3xl">
            Things tradespeople <span className="text-lime">actually ask us.</span>
          </h1>

        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-20">
        <div className="divide-y divide-ink/10">
          {faqs.map((f) => (
            <details key={f.q} className="group py-6">
              <summary className="flex items-center justify-between cursor-pointer list-none">
                <h3 className="text-xl md:text-2xl pr-6">{f.q}</h3>
                <span className="h-8 w-8 rounded-full bg-ink/5 group-hover:bg-lime/40 transition flex items-center justify-center shrink-0 text-ink text-lg leading-none">
                  <span className="group-open:hidden">+</span>
                  <span className="hidden group-open:inline">-</span>
                </span>
              </summary>
              <p className="mt-3 text-base text-ink/70 leading-relaxed max-w-2xl">{f.a}</p>
            </details>
          ))}
        </div>

        <div className="mt-16 text-center">
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 bg-ink text-paper font-semibold px-7 py-4 rounded-full hover:bg-ink/90 transition"
          >
            Start free trial <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
