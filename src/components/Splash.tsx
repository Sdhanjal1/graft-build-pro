import { useEffect, useState } from "react";
import logo from "@/assets/quottr-logo.png";

const SHOWN_KEY = "quottr_splash_shown";

export function Splash() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SHOWN_KEY)) return;
    setVisible(true);
    sessionStorage.setItem(SHOWN_KEY, "1");
    const t = setTimeout(() => setVisible(false), 1500);
    return () => clearTimeout(t);
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
