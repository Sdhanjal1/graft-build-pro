import { useEffect, useMemo, useState } from "react";
import { userProfile } from "@/lib/user-data";
import { resolveTrade } from "@/lib/trades";

const FALLBACK = [
  "Try: Quote Mrs Jones for the job you just finished, £180",
  "Try: Two hours labour at £65/hr plus £40 materials",
];

export function RotatingPrompts({ className = "" }: { className?: string }) {
  const prompts = useMemo(() => {
    const trade = resolveTrade(userProfile.trade_type);
    const fromTemplates = trade.quoteTemplates.slice(0, 4).map((t) => {
      // Keep it short — first sentence of the template prompt.
      const short = t.prompt.split(/[.,]/)[0].trim();
      return `Try: ${short}`;
    });
    const mic = `Try: ${trade.homeMicExample}`;
    const list = [mic, ...fromTemplates].filter(Boolean);
    return list.length > 0 ? list : FALLBACK;
  }, []);

  const [i, setI] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let swap: ReturnType<typeof setTimeout> | null = null;
    const t = setInterval(() => {
      setVisible(false);
      swap = setTimeout(() => {
        setI((n) => (n + 1) % prompts.length);
        setVisible(true);
      }, 300);
    }, 4000);
    return () => {
      clearInterval(t);
      if (swap) clearTimeout(swap);
    };
  }, [prompts.length]);

  return (
    <p
      className={`text-xs italic text-muted-foreground transition-opacity duration-300 line-clamp-2 overflow-hidden ${
        visible ? "opacity-100" : "opacity-0"
      } ${className}`}
      style={{ minHeight: "2.4em", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
      aria-live="polite"
    >
      {prompts[i]}
    </p>
  );
}
