import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useSession } from "@/lib/auth";
import { Share2, QrCode, Bell, BellOff } from "lucide-react";
import { feedback } from "@/lib/feedback";

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
        alert("Link copied to clipboard");
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
        Show this on your van, business card or invoice. Customers scan it to send you a quote request — by text or voice.
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

export function PushPermissionCard() {
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) { setPerm("unsupported"); return; }
    setPerm(Notification.permission);
  }, []);

  const enable = async () => {
    feedback("tap");
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPerm(result);
    if (result === "granted") {
      new Notification("Quottr notifications enabled", {
        body: "You'll get a ping when a customer sends you a quote request.",
        icon: "/app-icon.png",
      });
    }
  };

  return (
    <div className="card-surface p-5">
      <div className="flex items-center gap-2 mb-3">
        {perm === "granted" ? <Bell className="h-4 w-4 text-lime" /> : <BellOff className="h-4 w-4" />}
        <p className="text-sm font-semibold">Push notifications</p>
      </div>
      {perm === "unsupported" && (
        <p className="text-xs text-muted-foreground">Your browser doesn't support notifications. Install Quottr to your home screen for the best experience.</p>
      )}
      {perm === "default" && (
        <>
          <p className="text-xs text-muted-foreground mb-3">
            Get an instant ping when a customer sends a new quote request. For best results, add Quottr to your home screen first.
          </p>
          <button
            onClick={enable}
            className="w-full bg-lime text-ink rounded-full py-3 text-sm font-bold inline-flex items-center justify-center gap-2"
          >
            <Bell className="h-4 w-4" />
            Enable notifications
          </button>
        </>
      )}
      {perm === "granted" && (
        <p className="text-xs text-muted-foreground">Notifications are on. You'll be alerted to new customer requests when Quottr is open.</p>
      )}
      {perm === "denied" && (
        <p className="text-xs text-status-overdue">Notifications are blocked. Enable them in your browser or device settings to receive request alerts.</p>
      )}
    </div>
  );
}
