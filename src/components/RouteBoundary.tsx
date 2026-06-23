import { Link, useRouter } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft } from "lucide-react";

/**
 * Shared error fallback for signed-in routes. Used as a route's
 * `errorComponent` so a network blip or loader throw shows a recoverable
 * card instead of a blank screen. `router.invalidate()` re-runs the loader
 * AND `reset()` clears the boundary — calling only `reset()` would clear
 * the UI without re-fetching.
 */
export function RouteError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="min-h-[calc(100dvh-7rem)] grid place-items-center px-5 py-10">
      <div className="card-surface max-w-sm w-full p-6 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-status-overdue/15 grid place-items-center mb-3">
          <AlertTriangle className="h-6 w-6 text-status-overdue" />
        </div>
        <h1 className="text-lg font-semibold text-ink">Something went wrong</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {error?.message?.slice(0, 200) || "Tap retry, or check your signal and try again."}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="w-full rounded-full bg-ink text-paper text-sm font-semibold px-4 py-2.5 active:scale-95"
          >
            Try again
          </button>
          <Link
            to="/app"
            className="w-full rounded-full bg-paper text-ink text-sm font-semibold px-4 py-2.5 ring-1 ring-border active:scale-95"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Shared not-found fallback for signed-in routes. Replaces blank renders
 * when a loader throws `notFound()`.
 */
export function RouteNotFound({ title = "Not found", body = "We couldn't find what you were after." }: { title?: string; body?: string }) {
  return (
    <div className="min-h-[calc(100dvh-7rem)] grid place-items-center px-5 py-10">
      <div className="card-surface max-w-sm w-full p-6 text-center">
        <h1 className="text-lg font-semibold text-ink">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{body}</p>
        <Link
          to="/app"
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink text-paper text-sm font-semibold px-4 py-2.5 active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
      </div>
    </div>
  );
}
