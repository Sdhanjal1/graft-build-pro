import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useServerFn } from "@tanstack/react-start";
import { useSession } from "@/lib/auth";
import { Share2, QrCode, Bell, BellOff, Loader2 } from "lucide-react";
import { feedback } from "@/lib/feedback";
import { getVapidPublicKey, savePushSubscription, sendTestPush } from "@/lib/push.functions";
import { toast } from "sonner";

export function CustomerQRCard() {
  const { user } = useSession();
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);
  if (!user) return null;
  const url = `${origin}/request/${user.id}`;

  const share = async () => {
    feedback("tap");
    try {
      if (navigator.share) {
        await navigator.share({ title: "Request a quote", text: "Scan or tap to request a quote from me:", url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard");
      }
    } catch { /* user cancelled */ }
  };

  return (
    <div className="card-surface p-5">
      <div className="flex items-center gap-2 mb-3">
        <QrCode className="h-4 w-4" />
        <p className="text-sm font-semibold">Your customer QR code</p>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Show this on your van, business card or invoice. Customers scan it to send you a quote request, by text or voice.
      </p>
      <div className="bg-white border border-border rounded-2xl p-5 flex items-center justify-center">
        {origin && <QRCodeSVG value={url} size={180} bgColor="#ffffff" fgColor="#1a1a18" level="M" />}
      </div>
      <p className="text-[10px] text-muted-foreground mt-3 text-center break-all">{url}</p>
      <button
        onClick={share}
        className="mt-3 w-full bg-ink text-paper rounded-full py-3 text-sm font-bold inline-flex items-center justify-center gap-2"
      >
        <Share2 className="h-4 w-4" />
        Share link
      </button>
    </div>
  );
}

function b64uToU8(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "====".slice(s.length % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bufToB64u(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function PushPermissionCard() {
  const fetchKey = useServerFn(getVapidPublicKey);
  const saveSub = useServerFn(savePushSubscription);
  const testPush = useServerFn(sendTestPush);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPerm("unsupported");
      return;
    }
    setPerm(Notification.permission);
    void navigator.serviceWorker.getRegistration().then(async (reg) => {
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
    });
  }, []);

  const enable = async () => {
    feedback("tap");
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      setPerm(permission);
      if (permission !== "granted") return;
      // Ensure SW registered
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const { key } = await fetchKey();
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: b64uToU8(key) as unknown as BufferSource,
        });
      }
      const json = sub.toJSON() as any;
      await saveSub({
        data: {
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh ?? bufToB64u(sub.getKey("p256dh")),
          auth: json.keys?.auth ?? bufToB64u(sub.getKey("auth")),
          userAgent: navigator.userAgent.slice(0, 500),
        },
      });
      setSubscribed(true);
      await testPush();
      toast.success("Push notifications enabled");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Could not enable push notifications");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card-surface p-5">
      <div className="flex items-center gap-2 mb-3">
        {subscribed && perm === "granted" ? <Bell className="h-4 w-4 text-lime" /> : <BellOff className="h-4 w-4" />}
        <p className="text-sm font-semibold">Push notifications</p>
      </div>
      {perm === "unsupported" && (
        <p className="text-xs text-muted-foreground">Your browser doesn't support push. On iOS, install Quottr to your home screen first (iOS 16.4+).</p>
      )}
      {perm !== "unsupported" && !(subscribed && perm === "granted") && (
        <>
          <p className="text-xs text-muted-foreground mb-3">
            Get an instant ping for new quote requests, when a customer accepts a quote, and when a payment lands — even when Quottr is closed.
            On iOS, add Quottr to your home screen first (iOS 16.4+).
          </p>
          <button
            onClick={enable}
            disabled={busy}
            className="w-full bg-lime text-ink rounded-full py-3 text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
            {busy ? "Enabling…" : "Enable notifications"}
          </button>
          {perm === "denied" && (
            <p className="text-[11px] text-status-overdue mt-2">Notifications are blocked. Enable them in your browser or device settings.</p>
          )}
        </>
      )}
      {subscribed && perm === "granted" && (
        <>
          <p className="text-xs text-muted-foreground">Notifications are on for this device. You'll get a ping for new requests and customer messages.</p>
          <button
            onClick={async () => { await testPush(); toast.success("Test push sent"); }}
            className="mt-3 text-xs font-semibold text-ink underline"
          >
            Send a test
          </button>
        </>
      )}
    </div>
  );
}
