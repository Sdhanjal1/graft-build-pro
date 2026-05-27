import { CreditCard } from "lucide-react";

/**
 * Trust-signal row for the customer portal pay button.
 * Apple Pay / Google Pay surface automatically on Stripe-hosted Checkout —
 * this just tells the customer to expect them BEFORE they tap.
 */
export function WalletBadges({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground ${className}`}>
      <span className="inline-flex items-center gap-1 rounded-md border border-border bg-paper px-1.5 py-0.5 text-ink">
        <AppleMark className="h-3 w-3" /> Pay
      </span>
      <span className="inline-flex items-center gap-1 rounded-md border border-border bg-paper px-1.5 py-0.5 text-ink">
        <GMark className="h-3 w-3" /> Pay
      </span>
      <span className="inline-flex items-center gap-1 rounded-md border border-border bg-paper px-1.5 py-0.5 text-ink">
        <CreditCard className="h-3 w-3" /> Card
      </span>
    </div>
  );
}

function AppleMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M16.365 12.78c-.02-2.04 1.67-3.02 1.75-3.07-.95-1.39-2.43-1.58-2.96-1.6-1.26-.13-2.46.74-3.1.74-.65 0-1.63-.72-2.68-.7-1.38.02-2.65.8-3.36 2.04-1.43 2.48-.36 6.14 1.03 8.15.68.98 1.49 2.09 2.55 2.05 1.03-.04 1.42-.66 2.66-.66 1.24 0 1.59.66 2.68.64 1.11-.02 1.81-1 2.49-1.99.78-1.14 1.1-2.25 1.12-2.3-.02-.01-2.15-.83-2.18-3.3zM14.4 6.93c.56-.68.94-1.62.84-2.56-.81.03-1.79.54-2.37 1.21-.52.6-.98 1.56-.86 2.49.9.07 1.83-.46 2.39-1.14z" />
    </svg>
  );
}

function GMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M12 11v3h6.6c-.3 1.5-1.8 4.3-6.6 4.3-4 0-7.2-3.3-7.2-7.3S8 3.7 12 3.7c2.3 0 3.8.9 4.6 1.7l2.2-2.2C17.3 1.8 14.9.7 12 .7 6.4.7 1.8 5.3 1.8 11S6.4 21.3 12 21.3c6.4 0 10.6-4.5 10.6-10.8 0-.7-.1-1.2-.2-1.7H12z" />
    </svg>
  );
}
