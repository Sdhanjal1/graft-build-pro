import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[70] flex justify-center px-3 pt-[max(env(safe-area-inset-top),0.5rem)] pointer-events-none"
    >
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-ink text-paper px-4 py-2 text-xs font-semibold shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)]">
        <WifiOff className="h-3.5 w-3.5" />
        You're offline — changes may not save
      </div>
    </div>
  );
}
