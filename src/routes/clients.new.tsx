import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { findOrCreateClient } from "@/lib/user-data";
import { Save } from "lucide-react";

export const Route = createFileRoute("/clients/new")({
  component: NewClientPage,
  validateSearch: (s: Record<string, unknown>): { name?: string } => ({
    name: typeof s.name === "string" ? s.name : undefined,
  }),
});

const PROPERTY_PRIMARY = ["Homeowner", "Landlord", "Commercial", "Letting agent"] as const;
const HOMEOWNER_SUBTYPES = [
  "Homeowner",
  "Homeowner, Victorian terrace",
  "Homeowner, semi-detached",
  "Homeowner, detached",
  "Homeowner, flat",
] as const;

const PHONE_RE = /^(\+?44|0)\s?7\d{3}\s?\d{6}$|^(\+?44|0)\s?[12]\d{2,3}\s?\d{3}\s?\d{3,4}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function NewClientPage() {
  const navigate = useNavigate();
  const { name: presetName } = Route.useSearch();
  const [name, setName] = useState(presetName ?? "");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [propertyType, setPropertyType] = useState<string>("Homeowner");
  const [notes, setNotes] = useState("");

  const [phoneHint, setPhoneHint] = useState<string | null>(null);
  const [emailHint, setEmailHint] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const primaryGroup = propertyType.startsWith("Homeowner") ? "Homeowner" : propertyType;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!name.trim()) {
      setError("Please enter a name");
      toast.error("Please enter a name");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const c = await findOrCreateClient(name, {
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        property_type: propertyType,
        notes: notes.trim() || undefined,
      });
      navigate({ to: "/clients/$clientId", params: { clientId: c.id } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save customer";
      console.error("[clients.new] save failed", err);
      setError(msg);
      toast.error(msg);
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <PageHeader title="New customer" subtitle="Add to customer book" back="/clients" />

      <form className="px-5 pb-6" onSubmit={save}>
        <div className="card-surface divide-y divide-border">
          <Field label="Full name" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Customer name"
              className="w-full bg-transparent outline-none text-sm"
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 divide-x divide-border">
            <Field label="Phone" hint={phoneHint}>
              <input
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (phoneHint) setPhoneHint(null);
                }}
                onBlur={() => {
                  const v = phone.trim();
                  setPhoneHint(v && !PHONE_RE.test(v) ? "Doesn't look like a UK number" : null);
                }}
                inputMode="tel"
                placeholder="07XXX XXXXXX"
                className="w-full bg-transparent outline-none text-sm"
              />
            </Field>
            <Field label="Email" hint={emailHint}>
              <input
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailHint) setEmailHint(null);
                }}
                onBlur={() => {
                  const v = email.trim();
                  setEmailHint(v && !EMAIL_RE.test(v) ? "Check the email format" : null);
                }}
                inputMode="email"
                placeholder="name@example.com"
                className="w-full bg-transparent outline-none text-sm"
              />
            </Field>
          </div>

          <Field label="Address">
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              placeholder="House no., street, town, postcode"
              className="w-full bg-transparent outline-none text-sm resize-none"
            />
          </Field>

          <Field label="Property type">
            <div className="-mx-1 flex gap-1.5 overflow-x-auto pb-1 pt-0.5 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {PROPERTY_PRIMARY.map((p) => {
                const active = primaryGroup === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPropertyType(p)}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition ${
                      active
                        ? "bg-ink text-paper border-ink"
                        : "bg-card text-ink border-border hover:border-ink/30"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
            <div className="min-h-[2.25rem]">
              {primaryGroup === "Homeowner" && (
                <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto pb-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {HOMEOWNER_SUBTYPES.map((p) => {
                    const active = propertyType === p;
                    const label = p === "Homeowner" ? "Any" : p.replace("Homeowner, ", "");
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPropertyType(p)}
                        className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-medium border transition ${
                          active
                            ? "bg-lime/40 text-ink border-lime"
                            : "bg-transparent text-muted-foreground border-border hover:border-ink/30"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </Field>

          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Access notes, preferred times, boiler model…"
              className="w-full bg-transparent outline-none text-sm resize-none"
            />
          </Field>
        </div>

        {error && (
          <p className="mt-3 text-sm text-destructive text-center" role="alert">{error}</p>
        )}
      </form>

      {/* Sticky save bar */}
      <div
        className="fixed left-0 right-0 z-30 pointer-events-none"
        style={{ bottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto max-w-md">
          <div className="h-6 -mb-2 bg-gradient-to-t from-paper to-transparent pointer-events-none" />
          <div className="px-5 pb-5 pt-2 pointer-events-auto bg-paper">
            <button
              type="button"
              onClick={(e) => save(e as unknown as React.FormEvent)}
              disabled={!name.trim() || saving}
              className="w-full bg-lime text-ink rounded-full py-4 font-bold inline-flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.99] transition shadow-lg shadow-ink/10"
            >
              <Save className="h-5 w-5" /> {saving ? "Saving…" : "Save customer"}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="block p-4">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
        {label}
        {required && <span className="text-lime"> *</span>}
      </span>
      <div className="mt-2">{children}</div>
      {hint && <p className="mt-1.5 text-[11px] text-destructive">{hint}</p>}
    </label>
  );
}
