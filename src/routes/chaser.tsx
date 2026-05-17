import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import {
  mockQuotes, getClient, mockProfile, formatGBP, buildChaserMessage,
  chasesDueNow, upcomingChases, markChaseSent, skipChase,
} from "@/lib/mock-data";
import { MessageCircle, Phone, Mail, Clock, Check, X as XIcon } from "lucide-react";

export const Route = createFileRoute("/chaser")({
  component: ChaserPage,
});

function daysOverdue(due?: string) {
  if (!due) return 0;
  const ms = Date.now() - new Date(due).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function ChaserPage() {
  const overdue = mockQuotes.filter((q) => q.status === "overdue");
  const total = overdue.reduce((s, q) => s + q.total, 0);
  const [, force] = useState(0);
  const due = chasesDueNow();
  const upcoming = upcomingChases().slice(0, 4);

  return (
    <AppShell>
      <PageHeader title="Invoice chaser" subtitle="Overdue" back="/" />

      <section className="px-5">
        <div className="rounded-2xl bg-status-overdue/10 border border-status-overdue/30 p-5">
          <p className="text-xs uppercase tracking-widest text-status-overdue font-semibold">Total overdue</p>
          <p className="num text-4xl mt-1 text-status-overdue">{formatGBP(total)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {overdue.length} {overdue.length === 1 ? "invoice" : "invoices"} need chasing
          </p>
        </div>
      </section>

      <section className="px-5 mt-5 space-y-3">
        {overdue.map((q) => {
          const c = getClient(q.client_id);
          const firstName = c?.name.split(" ")[0] ?? "there";
          const chase = encodeURIComponent(buildChaserMessage(q, firstName));
          const digits = c?.phone.replace(/\D/g, "");
          const wa = `https://wa.me/${digits ? "44" + digits.replace(/^0/, "") : ""}?text=${chase}`;
          const subject = encodeURIComponent(`Overdue invoice ${q.ref} — ${mockProfile.business_name}`);
          const mail = `mailto:${c?.email}?subject=${subject}&body=${chase}`;
          const days = daysOverdue(q.due_date);
          return (
            <div key={q.id} className="card-surface p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{q.ref}</p>
                    <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full bg-status-overdue/15 text-status-overdue">
                      {days} day{days === 1 ? "" : "s"} overdue
                    </span>
                  </div>
                  <p className="font-semibold text-sm mt-0.5 truncate">{q.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{c?.name} · due {q.due_date}</p>
                </div>
                <p className="num text-2xl text-status-overdue">{formatGBP(q.total)}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4">
                <a href={wa} target="_blank" rel="noreferrer" className="bg-lime text-ink rounded-full py-2.5 text-xs font-bold inline-flex items-center justify-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5" />
                  WhatsApp
                </a>
                <a href={`tel:${c?.phone}`} className="bg-ink text-paper rounded-full py-2.5 text-xs font-bold inline-flex items-center justify-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  Call
                </a>
                <a href={mail} className="bg-card border border-border text-ink rounded-full py-2.5 text-xs font-bold inline-flex items-center justify-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </a>
              </div>
            </div>
          );
        })}
        {overdue.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-12">
            Nothing overdue. Nice one. 🎉
          </p>
        )}
      </section>
    </AppShell>
  );
}
