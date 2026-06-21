import { createFileRoute } from "@tanstack/react-router";
import { MarketingShell } from "@/components/MarketingShell";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms of Service, Quottr" },
      { name: "description", content: "The rules of using Quottr, plain English, for UK tradespeople." },
    ],
  }),
});

function TermsPage() {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-5 py-16 md:py-24">
        <p className="text-[11px] uppercase tracking-widest text-ink/75 font-semibold">Legal</p>
        <h1
          className="mt-3 text-5xl md:text-7xl leading-[0.95]"
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
        >
          Terms of Service
        </h1>
        <p className="mt-4 text-sm text-ink/80">Last updated: 22 May 2026</p>

        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-ink/80">
          <Section title="The basics">
            <p>
              By creating a Quottr account you agree to these terms. Quottr is operated as a UK service for self-employed
              tradespeople and small trade businesses. If you don't agree with these terms, please don't use Quottr.
            </p>
          </Section>

          <Section title="Your account">
            <p>You must be 18+ and provide accurate details. You're responsible for keeping your password safe and for
              everything that happens on your account. One person per account, sharing logins is not permitted.</p>
          </Section>

          <Section title="What you can do">
            <p>Use Quottr to quote, invoice and chase payment for legitimate trade work in the UK. Don't use it for anything
              illegal, fraudulent, abusive, or to spam your clients.</p>
          </Section>

          <Section title="Trial and payment">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>The 14-day trial is free. No card required to start.</li>
              <li>After the trial, a paid subscription is required to keep using the service.</li>
              <li>Subscriptions renew automatically until cancelled. Cancel any time from Settings.</li>
              <li>We don't offer refunds for partial months, but you keep access until the end of the paid period.</li>
            </ul>
          </Section>

          <Section title="Your content">
            <p>You own everything you put into Quottr, your quotes, clients, photos, voice notes. We just store it and
              process it so the service can work. See the{" "}
              <a className="underline hover:text-ink" href="/privacy">Privacy Policy</a> for details.
            </p>
          </Section>

          <Section title="AI-generated quotes">
            <p>
              Quottr uses AI to turn your voice notes and site photos into draft quotes. <strong>You are responsible for
              reviewing every quote before you send it.</strong> We don't guarantee that AI-generated pricing is accurate
              for your job, it's a starting point, not a substitute for your trade judgement.
            </p>
          </Section>

          <Section title="Payments and Stripe">
            <p>
              Quottr uses Stripe to take payments from your clients. By accepting payments through Quottr you also agree
              to the Stripe Connected Account Agreement. Stripe fees are deducted from each transaction.
            </p>
          </Section>

          <Section title="Uptime and limits">
            <p>
              We aim for high availability but don't guarantee Quottr will be available 100% of the time. We may
              throttle, suspend or terminate accounts that abuse the service, send spam, or put the system at risk.
            </p>
          </Section>

          <Section title="Liability">
            <p>
              Quottr is provided "as is". To the maximum extent allowed by law, our total liability for any claim is
              limited to the amount you paid us in the 12 months before the claim. We are not liable for lost profits,
              lost jobs, or any indirect or consequential losses.
            </p>
          </Section>

          <Section title="Ending the agreement">
            <p>
              You can delete your account at any time. We can suspend or close accounts that breach these terms.
            </p>
          </Section>

          <Section title="Governing law">
            <p>
              These terms are governed by the laws of England and Wales. Any disputes will be handled by the courts of
              England and Wales.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about these terms? Email{" "}
              <a className="underline hover:text-ink" href="mailto:hello@quottr.co.uk">hello@quottr.co.uk</a>.
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
