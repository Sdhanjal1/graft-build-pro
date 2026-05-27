import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { getClient, quotesForClient, formatGBP, userProfile } from "@/lib/user-data";
import { resolveTrade, detectCertifications, type Certification } from "@/lib/trades";
import { Phone, Mail, MapPin, Home, FileText, Plus, CheckCircle2, Calendar, ShieldCheck, BellRing } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { CustomerPortalPanel } from "@/components/CustomerPortalPanel";


export const Route = createFileRoute("/clients/$clientId")({
  component: ClientDetail,
  notFoundComponent: () => <div className="p-8 text-center">Customer not found</div>,
});

function relativeFromNow(iso: string): string {
  const diffDays = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (diffDays < 1) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  const months = Math.round(diffDays / 30);
  if (months < 12) return `${months}mo ago`;
  const years = (diffDays / 365).toFixed(1).replace(/\.0$/, "");
  return `${years}y ago`;
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function ClientDetail() {
  const { clientId } = Route.useParams();
  const client = getClient(clientId);
  if (!client) throw notFound();

  const quotes = quotesForClient(clientId);
  const totalQuoted = quotes.reduce((s, q) => s + q.total, 0);
  const totalPaid = quotes.filter((q) => q.status === "paid").reduce((s, q) => s + q.total, 0);

  // Service history derivations
  const sortedQuotes = [...quotes].sort((a, b) => {
    const aDate = a.completed_at ?? a.created_at;
    const bDate = b.completed_at ?? b.created_at;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });
  const completedJobs = quotes.filter((q) => q.completed_at || q.status === "paid");
  const lastService = completedJobs
    .map((q) => q.completed_at ?? q.created_at)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  const customerSince = client.created_at;

  return (
    <AppShell>
      <PageHeader title={client.name} subtitle="Customer" back="/clients" />

      <section className="px-5 grid grid-cols-2 gap-3">
        <div className="card-surface p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Total quoted</p>
          <p className="num text-2xl mt-1">{formatGBP(totalQuoted)}</p>
        </div>
        <div className="card-surface p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Paid</p>
          <p className="num text-2xl mt-1 text-status-accepted">{formatGBP(totalPaid)}</p>
        </div>
      </section>

      <section className="px-5 mt-3">
        <div className="card-surface p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0 text-sm">
            <p className="font-semibold">
              {completedJobs.length} job{completedJobs.length === 1 ? "" : "s"} completed
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {lastService ? `Last service ${relativeFromNow(lastService)} · ` : ""}
              Customer since {formatShortDate(customerSince)}
            </p>
          </div>
        </div>
      </section>

      <section className="px-5 mt-4">
        <div className="card-surface p-5 space-y-3">
          <Row icon={Phone} label="Phone" value={client.phone} href={`tel:${client.phone}`} />
          <Row icon={Mail} label="Email" value={client.email} href={`mailto:${client.email}`} />
          <Row icon={MapPin} label="Address" value={client.address} />
          <Row icon={Home} label="Property" value={client.property_type} />
          {client.notes && (
            <div className="pt-3 border-t border-border">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Notes</p>
              <p className="text-sm mt-1">{client.notes}</p>
            </div>
          )}
        </div>
      </section>

      <section className="px-5 mt-6">
        <h2 className="text-xl mb-2.5">Customer portal</h2>
        <CustomerPortalPanel clientId={clientId} />
      </section>


      <section className="mt-6">
        <div className="px-5 flex items-center justify-between mb-2.5">
          <h2 className="text-xl">Job history</h2>
          <Link
            to="/quotes/new"
            search={{ clientId }}
            className="inline-flex items-center gap-1.5 rounded-full bg-lime text-ink px-3.5 py-2 text-xs font-bold active:scale-[0.98] transition"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Quote again
          </Link>
        </div>
        <div className="px-5 space-y-2.5">
          {quotes.length === 0 && (
            <EmptyState
              icon={FileText}
              title="No quotes yet"
              body={`Send ${client.name.split(" ")[0]} their first quote in a couple of taps.`}
              cta={{ label: "New quote", to: "/quotes/new", search: { clientId } }}
            />
          )}
          {sortedQuotes.map((q) => {
            const dateIso = q.completed_at ?? q.created_at;
            const dateLabel = q.completed_at ? `Completed ${formatShortDate(q.completed_at)}` : formatShortDate(q.created_at);
            return (
              <Link
                to="/quotes/$quoteId"
                params={{ quoteId: q.id }}
                key={q.id}
                className="card-surface p-4 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{q.ref}</p>
                    <StatusBadge status={q.status} />
                  </div>
                  <p className="font-semibold text-sm mt-1 truncate">{q.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>{dateLabel}</span>
                    <span>· {relativeFromNow(dateIso)}</span>
                  </p>
                </div>
                <p className="num text-xl text-ink">{formatGBP(q.total)}</p>
              </Link>
            );
          })}

        </div>
      </section>
    </AppShell>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <div className="flex items-start gap-3">
      <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
  return href ? <a href={href}>{content}</a> : content;
}
