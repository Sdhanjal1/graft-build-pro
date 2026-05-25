import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { findOrCreateClient } from "@/lib/user-data";
import { Save } from "lucide-react";

export const Route = createFileRoute("/clients/new")({
  component: NewClientPage,
});

function NewClientPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [propertyType, setPropertyType] = useState("Homeowner");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
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
      setError(err instanceof Error ? err.message : "Could not save customer");
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <PageHeader title="New customer" subtitle="Add to customer book" back="/clients" />

      <form className="px-5 space-y-3" onSubmit={save}>
        <Field label="Full name" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Customer name"
            className="w-full bg-transparent outline-none text-sm"
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder="07XXX XXXXXX"
              className="w-full bg-transparent outline-none text-sm"
            />
          </Field>
          <Field label="Email">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
          <select
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value)}
            className="w-full bg-transparent outline-none text-sm font-medium"
          >
            <option>Homeowner</option>
            <option>Homeowner, Victorian terrace</option>
            <option>Homeowner, semi-detached</option>
            <option>Homeowner, detached</option>
            <option>Homeowner, flat</option>
            <option>Landlord</option>
            <option>Commercial</option>
            <option>Letting agent</option>
          </select>
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

        <button
          type="submit"
          disabled={!name.trim()}
          className="w-full bg-lime text-ink rounded-full py-4 font-bold inline-flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Save className="h-5 w-5" /> Save customer
        </button>
      </form>
    </AppShell>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="card-surface p-4 block">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
        {label}{required && <span className="text-lime"> *</span>}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  );
}
