import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getClientPortalInfo,
  regeneratePortalCode,
  togglePortalActive,
  listClientDocuments,
  addClientDocument,
  deleteClientDocument,
  toggleDocumentPortalVisible,
  updateServiceReminder,
} from "@/lib/portal.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  Link2,
  Copy,
  Check,
  RefreshCcw,
  ExternalLink,
  Upload,
  Trash2,
  FileText,
  Loader2,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ConfirmTarget =
  | { type: "regen" }
  | { type: "delete-doc"; id: string; title: string };

const isUuid = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export function CustomerPortalPanel({ clientId }: { clientId: string }) {
  const fetchInfo = useServerFn(getClientPortalInfo);
  const regen = useServerFn(regeneratePortalCode);
  const toggleActive = useServerFn(togglePortalActive);
  const fetchDocs = useServerFn(listClientDocuments);
  const addDoc = useServerFn(addClientDocument);
  const delDoc = useServerFn(deleteClientDocument);
  const toggleDocVis = useServerFn(toggleDocumentPortalVisible);
  const saveReminder = useServerFn(updateServiceReminder);

  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);
  const [info, setInfo] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadKind] =
    useState<"certificate" | "service" | "warranty" | "other">("certificate");
  const [serviceType, setServiceType] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [pendingConfirm, setPendingConfirm] = useState<ConfirmTarget | null>(null);
  const canNativeShare =
    typeof navigator !== "undefined" && typeof (navigator as any).share === "function";

  useEffect(() => {
    if (!isUuid(clientId)) {
      setLoading(false);
      setAvailable(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetchInfo({ data: { clientId } });
        if (!r.client) {
          if (!cancelled) setAvailable(false);
          return;
        }
        const d = await fetchDocs({ data: { clientId } });
        if (cancelled) return;
        setInfo(r.client);
        setDocs(d.documents);
        setServiceType(r.client.service_type ?? "");
        setServiceDate(r.client.service_due_date ?? "");
        setAvailable(true);
      } catch {
        if (!cancelled) setAvailable(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  if (loading) {
    return (
      <div className="card-surface p-5 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading portal…
      </div>
    );
  }

  if (!available) {
    return (
      <div className="card-surface p-5">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          Customer portal
        </p>
        <p className="text-sm mt-2 text-muted-foreground">
          The portal becomes available once this client is saved to your client book.
        </p>
      </div>
    );
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/portal/c/${info.portal_code}`;

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Your customer portal", url });
      } catch {}
    } else {
      await copy();
    }
  };

  const performRegen = async () => {
    try {
      const r = await regen({ data: { clientId } });
      setInfo({ ...info, portal_code: r.portal_code });
      toast.success("Portal link regenerated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not regenerate link");
    }
  };

  const onToggleActive = async (active: boolean) => {
    await toggleActive({ data: { clientId, active } });
    setInfo({ ...info, portal_active: active });
  };

  const onUpload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Max file size is 10MB");
      return;
    }
    setUploading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) throw new Error("Not signed in");
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${userId}/${clientId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("client-docs")
        .upload(path, file, { upsert: false });
      if (error) throw error;
      const r = await addDoc({
        data: {
          clientId,
          title: file.name,
          kind: uploadKind,
          file_url: path,
        },
      });
      setDocs([r.document, ...docs]);
      toast.success("Document added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const performDelete = async (id: string) => {
    try {
      await delDoc({ data: { documentId: id } });
      setDocs(docs.filter((d) => d.id !== id));
      toast.success("Document removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    }
  };

  const onToggleVis = async (id: string, visible: boolean) => {
    await toggleDocVis({ data: { documentId: id, visible } });
    setDocs(docs.map((d) => (d.id === id ? { ...d, portal_visible: visible } : d)));
  };

  const onSaveReminder = async () => {
    await saveReminder({
      data: {
        clientId,
        service_type: serviceType.trim() || null,
        service_due_date: serviceDate || null,
      },
    });
    toast.success("Reminder saved");
  };

  return (
    <div className="space-y-3">
      {/* Portal link */}
      <div className="card-surface p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Customer portal
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Share this private link with {info.name ?? "your customer"} so they can view their documents and reminders.
        </p>
        {canNativeShare ? (
          <button
            onClick={share}
            className="w-full rounded-full bg-lime text-ink py-2.5 text-xs font-bold inline-flex items-center justify-center gap-1.5"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share link
          </button>
        ) : (
          <button
            onClick={copy}
            className="w-full rounded-full bg-lime text-ink py-2.5 text-xs font-bold inline-flex items-center justify-center gap-1.5"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy link"}
          </button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-border bg-card py-2.5 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Preview
          </a>
          <button
            onClick={() => setPendingConfirm({ type: "regen" })}
            className="rounded-full border border-border bg-card py-2.5 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
          >
            <RefreshCcw className="h-3.5 w-3.5" /> Regenerate
          </button>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-sm font-medium">Portal active</span>
          <Switch
            checked={!!info.portal_active}
            onCheckedChange={(v) => void onToggleActive(v)}
          />
        </div>
      </div>

      {/* Service reminder */}
      <div className="card-surface p-5 space-y-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          Annual service reminder
        </p>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            placeholder="e.g. boiler service"
            className="bg-secondary rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-lime/40"
          />
          <input
            type="date"
            value={serviceDate}
            onChange={(e) => setServiceDate(e.target.value)}
            className="bg-secondary rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-lime/40"
          />
        </div>
        <button
          onClick={onSaveReminder}
          className="w-full rounded-full bg-lime text-ink py-2.5 text-xs font-bold"
        >
          Save reminder
        </button>
      </div>

      {/* Documents */}
      <div className="card-surface p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Documents in portal
          </p>
          <label className="rounded-full bg-lime text-ink px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer">
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Upload
            <input
              type="file"
              className="hidden"
              accept="application/pdf,image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onUpload(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {docs.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center">No documents yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {docs.map((d) => (
              <li key={d.id} className="py-2.5 flex items-center gap-2.5">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <a
                  href={d.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 min-w-0 text-sm truncate hover:underline"
                >
                  {d.title}
                </a>
                <div className="inline-flex items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                    Visible
                  </span>
                  <Switch
                    checked={!!d.portal_visible}
                    onCheckedChange={(v) => void onToggleVis(d.id, v)}
                  />
                </div>
                <button
                  onClick={() =>
                    setPendingConfirm({ type: "delete-doc", id: d.id, title: d.title })
                  }
                  className="text-muted-foreground p-1.5"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AlertDialog
        open={!!pendingConfirm}
        onOpenChange={(o) => { if (!o) setPendingConfirm(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingConfirm?.type === "regen"
                ? "Generate a new portal link?"
                : "Remove this document?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingConfirm?.type === "regen"
                ? "The old link will stop working immediately. Anyone using the old link won't be able to access the portal."
                : pendingConfirm?.type === "delete-doc"
                  ? `"${pendingConfirm.title}" will be deleted from this customer's portal.`
                  : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const c = pendingConfirm;
                setPendingConfirm(null);
                if (!c) return;
                if (c.type === "regen") void performRegen();
                else if (c.type === "delete-doc") void performDelete(c.id);
              }}
              className="bg-status-overdue text-paper hover:bg-status-overdue/90"
            >
              {pendingConfirm?.type === "regen" ? "Regenerate link" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
