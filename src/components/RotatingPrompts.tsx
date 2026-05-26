import { useEffect, useState } from "react";

const PROMPTS = [
  "Try: Quote Mrs Jones for a combi boiler, Worcester 30i for £1,250, 8 hours labour at £65",
  "Try: Bathroom refit, suite £850, tiles £450, labour £1,200, four days",
  "Try: Consumer unit replacement, £450 parts, full day labour £400",
  "Try: Three radiators at £150 each, 6 hours labour at £65 an hour, magnetic filter £85",
  "Try: Power flush, charging £450, plus magnetic filter £85",
  "Try: Roof repair, 10 tiles £40, lead flashing £120, half day labour £220",
];

export function RotatingPrompts({ className = "" }: { className?: string }) {
  const [i, setI] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false);
      const swap = setTimeout(() => {
        setI((n) => (n + 1) % PROMPTS.length);
        setVisible(true);
      }, 300);
      return () => clearTimeout(swap);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <p
      className={`text-xs italic text-lime transition-opacity duration-300 line-clamp-2 overflow-hidden ${
        visible ? "opacity-100" : "opacity-0"
      } ${className}`}
      style={{ minHeight: "2.4em", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
      aria-live="polite"
    >
      {PROMPTS[i]}
    </p>
  );
}
