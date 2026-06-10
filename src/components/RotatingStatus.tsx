import { useEffect, useState } from "react";

/**
 * Rotating status messages for slow async operations.
 * Cycles through messages every `intervalMs` while mounted.
 */
export function RotatingStatus({
  messages,
  intervalMs = 1500,
  className = "",
}: {
  messages: string[];
  intervalMs?: number;
  className?: string;
}) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return;
    const t = setInterval(() => {
      setI((n) => (n + 1) % messages.length);
    }, intervalMs);
    return () => clearInterval(t);
  }, [messages, intervalMs]);

  return (
    <span className={className} aria-live="off">
      {messages[i]}
    </span>
  );
}

export const QUOTE_GEN_MESSAGES = [
  "Listening to your job…",
  "Checking 2026 UK trade prices…",
  "Pricing parts…",
  "Calculating labour…",
  "Adding your branding…",
  "Almost there…",
];
