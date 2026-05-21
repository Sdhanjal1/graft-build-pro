import { useEffect, useState } from "react";

const PROMPTS = [
  "Try: Quote Mrs Jones for a new combi boiler",
  "Try: Full bathroom refit in Stockport — 5 days labour",
  "Try: Consumer unit replacement and EICR",
  "Try: Power flush and magnetic filter on a 3 bed",
  "Try: Roof repair — 10 tiles, lead flashing, half day labour",
  "Try: Supply and fit Worcester Bosch 30i, Gas Safe cert",
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
      className={`text-xs italic text-lime transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      } ${className}`}
      aria-live="polite"
    >
      {PROMPTS[i]}
    </p>
  );
}
