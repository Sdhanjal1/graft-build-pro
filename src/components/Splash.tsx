import { useEffect, useState } from "react";
import logo from "@/assets/quottr-logo.png";

const SHOWN_KEY = "quottr_splash_shown";
const LAST_ACTIVE_KEY = "quottr_last_active";
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

export function Splash() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const now = Date.now();
    const lastActive = Number(sessionStorage.getItem(LAST_ACTIVE_KEY) || 0);
    const recentlyActive = lastActive && now - lastActive < ACTIVE_WINDOW_MS;
    sessionStorage.setItem(LAST_ACTIVE_KEY, String(now));

    if (sessionStorage.getItem(SHOWN_KEY) || recentlyActive) return;
    setVisible(true);
    sessionStorage.setItem(SHOWN_KEY, "1");
    const t = setTimeout(() => setVisible(false), 800);
    return () => clearTimeout(t);
  }, []);

  // Heartbeat: keep last-active timestamp fresh while app is open
  useEffect(() => {
    if (typeof window === "undefined") return;
    const tick = () => sessionStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
    const id = window.setInterval(tick, 30_000);
    window.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("visibilitychange", tick);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-ink flex flex-col items-center justify-center px-6 animate-in fade-in duration-300">
      <img src={logo} alt="Quottr." className="h-20 w-auto" />
      <p className="mt-5 text-paper text-sm font-medium" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        Quote in seconds. Get paid faster.
      </p>
    </div>
  );
}
