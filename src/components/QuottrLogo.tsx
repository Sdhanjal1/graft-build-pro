import logo from "@/assets/quottr-logo.png";

export function QuottrLogo({ className = "h-8 w-auto" }: { className?: string }) {
  return <img src={logo} alt="Quottr." className={className} />;
}

/** Lime text wordmark in Bebas Neue, for use on dark backgrounds. */
export function QuottrWordmark({ className = "text-2xl" }: { className?: string }) {
  return (
    <span
      className={`text-lime leading-none tracking-tight ${className}`}
      style={{ fontFamily: "'Bebas Neue', sans-serif" }}
    >
      Quottr.
    </span>
  );
}
