import { createFileRoute } from "@tanstack/react-router";
import { VocaTradeLogo } from "@/components/VocaTradeLogo";

export const Route = createFileRoute("/logo-preview")({
  component: LogoPreviewPage,
});

function LogoPreviewPage() {
  return (
    <div className="min-h-screen bg-paper p-8 space-y-12">
      <section>
        <h2 className="text-sm uppercase tracking-widest text-ink/60 mb-4">Full (two-tone) on ink</h2>
        <div className="bg-ink rounded-2xl p-8 space-y-8">
          <VocaTradeLogo variant="full" className="h-40 w-auto" />
          <VocaTradeLogo variant="full" className="h-20 w-auto" />
          <VocaTradeLogo variant="full" joined={false} className="h-8 w-auto" />
          <p className="text-paper/50 text-xs">Small (joined=false) — for nav / header</p>
        </div>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-widest text-ink/60 mb-4">Mono (ink) on paper</h2>
        <div className="bg-paper border border-ink/10 rounded-2xl p-8 space-y-8">
          <VocaTradeLogo variant="mono" className="h-40 w-auto" />
          <VocaTradeLogo variant="mono" className="h-20 w-auto" />
          <VocaTradeLogo variant="mono" joined={false} className="h-8 w-auto" />
          <p className="text-ink/50 text-xs">Small (joined=false) — for invoices / PDFs</p>
        </div>
      </section>
    </div>
  );
}
