import { createFileRoute } from "@tanstack/react-router";
import { MarketingShell } from "@/components/MarketingShell";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Privacy Policy, Quottr" },
      { name: "description", content: "How Quottr collects, uses and protects the personal data of UK tradespeople and their clients." },
    ],
  }),
});

function PrivacyPage() {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-5 py-16 md:py-24">
        <p className="text-[11px] uppercase tracking-widest text-ink/50 font-semibold">Legal</p>
        <h1
          className="mt-3 text-5xl md:text-7xl leading-[0.95]"
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
        >
          Privacy Policy
        </h1>
        <p className="mt-4 text-sm text-ink/60">Last updated: 22 May 2026</p>

        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-ink/80">
          <Section title="Who we are">
            <p>
              Quottr ("we", "us", "our") is a quoting and invoicing service for UK tradespeople. We are the data
              controller for the personal data you provide when you use Quottr. You can reach us at{" "}
              <a className="underline hover:text-ink" href="mailto:hello@quottr.co.uk">hello@quottr.co.uk</a>.
            </p>
          </Section>

          <Section title="What we collect">
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Account data</strong>, name, email address, password (hashed), business name, trade.</li>
              <li><strong>Customer data you upload</strong>, your clients' names, addresses, emails, phone numbers, job notes, photos and voice notes.</li>
              <li><strong>Payment data</strong>, handled by Stripe; we never see or store full card numbers.</li>
              <li><strong>Usage data</strong>, pages visited, features used, device type, IP address, for product analytics and security.</li>
            </ul>
          </Section>

          <Section title="How we use it">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>To provide the service, generating quotes, sending them to your clients, taking payment.</li>
              <li>To improve the product and fix bugs.</li>
              <li>To send service emails (receipts, password resets, important account notices).</li>
              <li>To detect fraud and keep accounts secure.</li>
            </ul>
            <p className="mt-3">
              We do not sell your data and we do not sell your clients' data. Ever.
            </p>
          </Section>

          <Section title="Who we share it with">
            <p>Only the processors we need to run the service:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><strong>Supabase</strong>, database and authentication (EU hosting).</li>
              <li><strong>Stripe</strong>, payment processing.</li>
              <li><strong>OpenAI / Anthropic / Google</strong>, AI processing of voice notes and quote text.</li>
              <li><strong>Resend</strong>, sending transactional email.</li>
            </ul>
            <p className="mt-3">
              We use AI providers strictly for processing your inputs into quotes. Your data is not used to train their models.
            </p>
          </Section>

          <Section title="Your rights (UK GDPR)">
            <p>You have the right to access, correct, export or delete your personal data. Email us at{" "}
              <a className="underline hover:text-ink" href="mailto:hello@quottr.co.uk">hello@quottr.co.uk</a>{" "}
              and we'll action requests within 30 days. You can also delete your account at any time from Settings.
            </p>
            <p className="mt-3">
              You can complain to the Information Commissioner's Office (ICO) if you think we've mishandled your data.
            </p>
          </Section>

          <Section title="Cookies">
            <p>
              We use a small number of strictly-necessary cookies (to keep you signed in) and, with your consent, basic
              analytics cookies to understand how the site is used. See the cookie banner on first visit.
            </p>
          </Section>

          <Section title="Retention">
            <p>
              We keep your account data for as long as your account is active. Once deleted, account data is removed
              within 30 days, except where we're required by law to keep records (e.g. tax records, kept for 6 years).
            </p>
          </Section>

          <Section title="Changes">
            <p>
              If we make material changes to this policy we'll email you. Continued use after the effective date means
              you accept the updated policy.
            </p>
          </Section>
        </div>
      </article>
    </MarketingShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-2xl md:text-3xl text-ink mb-3" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{title}</h2>
      <div>{children}</div>
    </section>
  );
}
