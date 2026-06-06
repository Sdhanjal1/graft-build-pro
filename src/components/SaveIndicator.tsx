import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface SaveIndicatorProps {
  isSaving: boolean;
  isSaved: boolean;
  error?: string | null;
  /** Show "Saving…" / "Saved" / error text alongside the icon. Default true. */
  showLabel?: boolean;
  className?: string;
}

/**
 * Tiny inline status pill for auto-saved fields. Pairs with `useAutoSave`.
 * Renders nothing while idle so it stays out of the way.
 */
export function SaveIndicator({
  isSaving,
  isSaved,
  error,
  showLabel = true,
  className = "",
}: SaveIndicatorProps) {
  if (!isSaving && !isSaved && !error) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 text-xs ${className}`}
    >
      {isSaving && (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          {showLabel && <span className="text-muted-foreground">Saving…</span>}
        </>
      )}
      {!isSaving && isSaved && !error && (
        <>
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          {showLabel && <span className="text-emerald-600">Saved</span>}
        </>
      )}
      {!isSaving && error && (
        <>
          <AlertCircle className="h-3.5 w-3.5 text-destructive" />
          {showLabel && <span className="text-destructive">{error}</span>}
        </>
      )}
    </div>
  );
}
