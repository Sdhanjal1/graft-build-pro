import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";

export function RootErrorBoundary({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const message =
    error instanceof Error ? error.message : "An unexpected error occurred.";

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center space-y-4">
        <h1 className="text-2xl font-bold text-ink">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => {
              void router.invalidate();
              reset();
            }}
            className="px-4 py-2 bg-lime text-ink rounded-lg font-bold active:scale-[0.98] transition"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = "/";
            }}
            className="px-4 py-2 bg-secondary text-ink rounded-lg font-semibold active:scale-[0.98] transition"
          >
            Go home
          </button>
        </div>
      </div>
    </div>
  );
}
