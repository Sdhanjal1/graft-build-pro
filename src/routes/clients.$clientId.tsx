import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { getClient, quotesForClient, formatGBP } from "@/lib/user-data";
import { Phone, Mail, MapPin, Home, FileText, Plus } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { CustomerPortalPanel } from "@/components/CustomerPortalPanel";

export const Route = createFileRoute("/clients/$clientId")({
  component: ClientDetail,
  notFoundComponent: () => <div className="p-8 text-center">Customer not found</div>,
});

function ClientDetail() {
  const { clientId } = Route.useParams();
  const client = getClient(clientId);
  if (!client) throw notFound();

  const quotes = quotesForClient(clientId);
  const totalQuoted = quotes.reduce((s, q) => s + q.total, 0);
  const totalPaid = quotes.filter((q) => q.status === "paid").reduce((s, q) => s + q.total, 0);

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
          {quotes.map((q) => (
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
              </div>
              <p className="num text-xl text-ink">{formatGBP(q.total)}</p>
            </Link>
          ))}
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
