import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, UserPlus, Search } from "lucide-react";
import { toast } from "sonner";
import { feedback } from "@/lib/feedback";
import { userClients, findOrCreateClient, assignClientToQuote, useDataVersion, type Client } from "@/lib/user-data";

type Props = {
  open: boolean;
  onClose: () => void;
  quoteId: string;
  onAssigned: (client: Client) => void;
};

export function AssignClientDialog({ open, onClose, quoteId, onAssigned }: Props) {
  useDataVersion();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = [...userClients].sort((a, b) => a.name.localeCompare(b.name));
    if (!needle) return list;
    return list.filter((c) => c.name.toLowerCase().includes(needle));
  }, [q]);

  const assign = async (client: Client) => {
    if (busy) return;
    setBusy(true);
    try {
      await assignClientToQuote(quoteId, client.id);
      feedback("success");
      toast.success(`Assigned to ${client.name}`);
      onAssigned(client);
      onClose();
    } catch (e) {
      feedback("error");
      toast.error(e instanceof Error ? e.message : "Could not assign client");
    } finally {
      setBusy(false);
    }
  };

  const createAndAssign = async () => {
    const name = q.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const client = await findOrCreateClient(name);
      await assignClientToQuote(quoteId, client.id);
      feedback("success");
      toast.success(`Added ${client.name}`);
      onAssigned(client);
      onClose();
    } catch (e) {
      feedback("error");
      toast.error(e instanceof Error ? e.message : "Could not add client");
    } finally {
      setBusy(false);
    }
  };

  const exactMatch = filtered.some((c) => c.name.toLowerCase() === q.trim().toLowerCase());

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a client to send</DialogTitle>
          <DialogDescription>Pick an existing client or create a new one.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search or type new name"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="max-h-72 overflow-y-auto -mx-1 px-1 space-y-1">
          {filtered.length === 0 && !q.trim() && (
            <p className="text-sm text-muted-foreground text-center py-6">No clients yet. Type a name to add one.</p>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => assign(c)}
              disabled={busy}
              className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-muted/60 active:bg-muted flex items-center gap-3 transition"
            >
              <div className="h-9 w-9 rounded-full bg-lime/30 flex items-center justify-center text-ink font-bold text-xs">
                {c.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{c.name}</p>
                {c.address && <p className="text-xs text-muted-foreground truncate">{c.address}</p>}
              </div>
            </button>
          ))}
        </div>
        {q.trim() && !exactMatch && (
          <button
            onClick={createAndAssign}
            disabled={busy}
            className="w-full bg-lime text-ink rounded-full py-3 font-bold inline-flex items-center justify-center gap-2 active:scale-[0.99] transition disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Add "{q.trim()}" as new client
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
