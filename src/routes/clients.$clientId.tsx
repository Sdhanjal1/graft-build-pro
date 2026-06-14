import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { getClient, quotesForClient, formatGBP, userProfile, useDataVersion, updateClientFields } from "@/lib/user-data";
import { resolveTrade, detectCertifications, type Certification } from "@/lib/trades";
import { Phone, Mail, MapPin, Home, FileText, Plus, CheckCircle2, Calendar, ShieldCheck, BellRing, User } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { CustomerPortalPanel } from "@/components/CustomerPortalPanel";
import { ClientDetailSkeleton } from "@/components/Skeletons";
import { useSession } from "@/lib/auth";
import { useAutoSave } from "@/hooks/use-auto-save";
import { SaveIndicator } from "@/components/SaveIndicator";


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
  useDataVersion();
  const { clientId } = Route.useParams();
  const { loading } = useSession();
  const client = getClient(clientId);

  if (loading) return <ClientDetailSkeleton />;
  if (!client) throw notFound();

  const trade = resolveTrade(userProfile.trade_type);
  const jobNoun = trade.noun.job;
  const jobPlural = trade.noun.jobPlural;
  const firstName = client.name.split(" ")[0];

  const quotes = quotesForClient(clientId);
  const totalQuoted = quotes.reduce((s, q) => s + q.total, 0);
  const totalPaid = quotes.filter((q) => q.status === "paid").reduce((s, q) => s + q.total, 0);

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

  const certsByQuote = new Map<string, Certification[]>();
  sortedQuotes.forEach((q) => {
    const haystack = [q.title, q.job_description, ...(q.line_items?.map((li) => li.description) ?? [])]
      .filter(Boolean)
      .join(" \n ");
    const found = detectCertifications(trade, haystack);
    if (found.length) certsByQuote.set(q.id, found);
  });

  return (
    <AppShell>
      <PageHeader
        title={client.name}
        subtitle="Customer"
        back="/clients"
        crumbs={["Customers", client.name]}
      />

      {/* Combined money summary — one outcome card */}
      <section className="px-5 mt-5">
        <div className="card-surface p-5">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-status-accepted" />
            Paid to date
          </p>
          <p className="num text-4xl mt-1 text-ink tabular-nums leading-none">{formatGBP(totalPaid)}</p>
          <p className="text-xs text-muted-foreground mt-2 tabular-nums">
            of {formatGBP(totalQuoted)} quoted across {quotes.length} {quotes.length === 1 ? jobNoun : jobPlural}
          </p>
        </div>
      </section>

      {/* Merged service summary + cadence */}
      <section className="px-5 mt-3">
        <div className="card-surface p-4 divide-y divide-border">
          <div className="flex items-center gap-3 pb-3">
            <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0 text-sm">
              <p className="font-semibold">
                {completedJobs.length} {completedJobs.length === 1 ? jobNoun : jobPlural} completed
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {lastService ? `Last ${jobNoun} ${relativeFromNow(lastService)} · ` : ""}
                Customer since {formatShortDate(customerSince)}
              </p>
            </div>
          </div>
          {trade.defaultServiceType && (
            <div className="flex items-center gap-3 pt-3">
              <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <BellRing className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0 text-sm">
                <p className="font-semibold truncate">{trade.defaultServiceType}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {trade.defaultServiceIntervalMonths
                    ? `Recommended every ${trade.defaultServiceIntervalMonths} months.`
                    : "Set a reminder to keep this customer's service on track."}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Contact block */}
      <section className="px-5 mt-4">
        <div className="card-surface p-4 space-y-2.5">
          <EditableRow
            icon={User}
            label="Name"
            initial={client.name}
            placeholder="Customer name"
            onSave={(v) => updateClientFields(clientId, { name: v })}
          />
          <EditableRow
            icon={Phone}
            label="Phone"
            type="tel"
            initial={client.phone}
            placeholder="07…"
            href={client.phone ? `tel:${client.phone.replace(/\s+/g, "")}` : undefined}
            onSave={(v) => updateClientFields(clientId, { phone: v })}
          />
          <EditableRow
            icon={Mail}
            label="Email"
            type="email"
            initial={client.email}
            placeholder="name@example.com"
            href={client.email ? `mailto:${client.email}` : undefined}
            onSave={(v) => updateClientFields(clientId, { email: v })}
          />
          <Row
            icon={MapPin}
            label="Address"
            value={client.address}
            href={client.address ? `https://maps.google.com/?q=${encodeURIComponent(client.address)}` : undefined}
          />
          <Row icon={Home} label="Property" value={client.property_type} />
        </div>
      </section>

      {/* Notes — promoted to its own card */}
      {client.notes && (
        <section className="px-5 mt-3">
          <div className="card-surface p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Notes</p>
            <p className="text-sm mt-1 whitespace-pre-line">{client.notes}</p>
          </div>
        </section>
      )}

      {/* Job history — promoted above portal */}
      <section className="mt-6">
        <div className="px-5 flex items-start justify-between gap-3 mb-2.5">
          <div className="min-w-0">
            <h2 className="text-xl">{jobNoun === "service" ? "Service" : "Job"} history</h2>
            <p className="text-xs text-muted-foreground mt-0.5">For {firstName}</p>
          </div>
          <Link
            to="/quotes/new"
            search={{ clientId }}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-lime text-ink px-3.5 py-2 text-xs font-bold active:scale-[0.98] transition"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            New quote
          </Link>
        </div>
        <div className="px-5 space-y-2.5">
          {quotes.length === 0 && (
            <EmptyState
              icon={FileText}
              title={`No ${jobPlural} yet`}
              body={`Send ${firstName} their first quote in a couple of taps.`}
              cta={{ label: "New quote", to: "/quotes/new", search: { clientId } }}
            />
          )}

          {sortedQuotes.map((q) => {
            const dateIso = q.completed_at ?? q.created_at;
            const dateLabel = q.completed_at ? `Completed ${formatShortDate(q.completed_at)}` : formatShortDate(q.created_at);
            const certs = certsByQuote.get(q.id) ?? [];
            return (
              <Link
                to="/quotes/$quoteId"
                params={{ quoteId: q.id }}
                key={q.id}
                className="card-surface p-4 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{q.ref}</p>
                    <StatusBadge status={q.status} />
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                    <p className="font-semibold text-sm truncate min-w-0">{q.title}</p>
                    {certs.map((c) => (
                      <span key={c.key} className="inline-flex items-center gap-1 rounded-full bg-lime/30 text-ink text-[10px] font-bold px-2 py-0.5 shrink-0">
                        <ShieldCheck className="h-2.5 w-2.5" strokeWidth={3} />
                        {c.label}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>{dateLabel}</span>
                    <span>· {relativeFromNow(dateIso)}</span>
                  </p>
                </div>

                <p className="num text-sm text-ink tabular-nums shrink-0">{formatGBP(q.total)}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Customer portal — demoted below history */}
      <section className="px-5 mt-6">
        <h2 className="text-xl mb-2.5">Customer portal</h2>
        <CustomerPortalPanel clientId={clientId} />
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
      <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
        <p className={`text-sm font-medium truncate ${href ? "text-ink underline-offset-2 hover:underline" : ""}`}>{value || "—"}</p>
      </div>
    </div>
  );
  return href ? (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined} className="block active:opacity-70">
      {content}
    </a>
  ) : (
    content
  );
}

function EditableRow({
  icon: Icon,
  label,
  initial,
  placeholder,
  type = "text",
  href,
  onSave,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  initial: string;
  placeholder?: string;
  type?: "text" | "tel" | "email";
  href?: string;
  onSave: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initial ?? "");
  const [focused, setFocused] = useState(false);
  const { isSaving, isSaved, error, handleChange } = useAutoSave<string>({
    onSave: (v) => onSave(v),
    errorTitle: `Couldn't save ${label.toLowerCase()}`,
  });

  return (
    <div className="flex items-start gap-3">
      <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold inline-flex items-center gap-1.5">
          {label}
          {href && value && !focused && (
            <a
              href={href}
              onClick={(e) => e.stopPropagation()}
              className="text-ink/60 hover:text-ink normal-case tracking-normal text-[11px] font-medium underline-offset-2 hover:underline"
            >
              {type === "tel" ? "Call" : type === "email" ? "Email" : "Open"}
            </a>
          )}
        </p>
        <div className="relative">
          <input
            type={type}
            value={value}
            placeholder={placeholder}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => {
              setValue(e.target.value);
              handleChange(e.target.value);
            }}
            className="mt-0.5 w-full bg-transparent border-0 border-b border-dashed border-border focus:border-solid focus:border-ink/40 px-0 py-1 pr-7 text-sm font-medium outline-none transition-colors placeholder:text-muted-foreground/60"
          />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none">
            <SaveIndicator isSaving={isSaving} isSaved={isSaved} error={error} />
          </div>
        </div>
      </div>
    </div>
  );
}
