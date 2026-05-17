import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { mockProfile, stats, mockQuotes, formatGBP } from "@/lib/mock-data";
import { Building2, User, Phone, Mail, BadgeCheck, Receipt, Key, LogOut, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const s = stats();
  const topJobs = [...mockQuotes].sort((a, b) => b.total - a.total).slice(0, 5);
  const max = Math.max(...topJobs.map((q) => q.total));

  return (
    <AppShell>
      <PageHeader title="Settings" subtitle="Account" />

      {/* Profit tracker */}
      <section className="px-5">
        <div className="card-surface p-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4" />
            <p className="text-sm font-semibold">Profit tracker</p>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <Mini label="Pending" value={formatGBP(s.pending)} />
            <Mini label="Accepted" value={formatGBP(s.accepted)} />
            <Mini label="Paid" value={formatGBP(s.paid)} accent />
          </div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
            Top jobs by value
          </p>
          <div className="space-y-2">
            {topJobs.map((q) => (
              <div key={q.id}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="truncate pr-2">{q.title}</span>
                  <span className="num">{formatGBP(q.total)}</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-lime rounded-full"
                    style={{ width: `${(q.total / max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Business profile */}
      <section className="px-5 mt-5">
        <h2 className="text-xl mb-2.5">Business details</h2>
        <div className="card-surface p-5 space-y-3.5">
          <Field icon={Building2} label="Business name" value={mockProfile.business_name} />
          <Field icon={User} label="Your name" value={mockProfile.full_name} />
          <Field icon={Phone} label="Phone" value={mockProfile.phone} />
          <Field icon={Mail} label="Email" value={mockProfile.email} />
          <Field icon={BadgeCheck} label="Trade" value={mockProfile.trade_type} />
          <Field icon={BadgeCheck} label="Registration" value={mockProfile.registration_number} />
          <Field icon={Receipt} label="VAT number" value={mockProfile.vat_number} />
        </div>
      </section>

      {/* API keys */}
      <section className="px-5 mt-5">
        <h2 className="text-xl mb-2.5">Integrations</h2>
        <div className="card-surface divide-y divide-border">
          <SettingRow icon={Key} label="Claude API key" status="Add to enable AI quotes" />
          <SettingRow icon={Key} label="OpenAI Whisper key" status="Add to enable voice-to-text" />
        </div>
      </section>

      <section className="px-5 mt-5 mb-6">
        <Link
          to="/auth"
          className="card-surface p-4 flex items-center gap-3 text-status-overdue font-semibold"
        >
          <LogOut className="h-5 w-5" />
          Sign out
        </Link>
      </section>
    </AppShell>
  );
}

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
      <p className={`num text-lg mt-0.5 ${accent ? "text-ink" : ""}`}>{value}</p>
    </div>
  );
}

function SettingRow({
  icon: Icon,
  label,
  status,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  status: string;
}) {
  return (
    <div className="px-5 py-4 flex items-center gap-3">
      <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{status}</p>
      </div>
      <span className="text-xs font-semibold text-ink bg-lime px-3 py-1.5 rounded-full">Add</span>
    </div>
  );
}
