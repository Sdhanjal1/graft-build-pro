import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton shown while the home/app screen is loading. */
export function HomeSkeleton() {
  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-ink rounded-b-3xl px-5 pt-5 pb-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-24 bg-paper/10" />
          <Skeleton className="h-3 w-20 bg-paper/10" />
        </div>
        <Skeleton className="mt-5 h-3 w-32 bg-paper/10" />
        <Skeleton className="mt-3 h-3 w-20 bg-paper/10" />
        <Skeleton className="mt-2 h-14 w-48 bg-paper/10" />
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-6 w-20 rounded-full bg-paper/10" />
          <Skeleton className="h-6 w-24 rounded-full bg-paper/10" />
        </div>
      </header>
      <section className="px-5 mt-4 space-y-2">
        <Skeleton className="h-16 w-full rounded-2xl bg-ink/5" />
        <Skeleton className="h-16 w-full rounded-2xl bg-ink/5" />
      </section>
      <section className="px-5 mt-5">
        <Skeleton className="h-56 w-full rounded-3xl bg-ink/5" />
      </section>
    </div>
  );
}

function QuoteCardSkeleton() {
  return (
    <div className="card-surface py-5 px-4 flex items-center gap-4 bg-card">
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-8 w-28 rounded-md bg-ink/5" />
        <Skeleton className="h-4 w-32 rounded-md bg-ink/5" />
        <Skeleton className="h-[11px] w-40 rounded-md bg-ink/5" />
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <Skeleton className="h-2.5 w-2.5 rounded-full bg-ink/5" />
        <Skeleton className="h-[10px] w-10 rounded-md bg-ink/5" />
      </div>
    </div>
  );
}

/** Skeleton shown while the quotes list is loading. */
export function QuotesListSkeleton() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="px-5 pt-6">
        <Skeleton className="h-3 w-20 bg-ink/10" />
        <Skeleton className="mt-2 h-7 w-32 bg-ink/10" />
      </div>
      <div className="px-5 mt-4">
        <Skeleton className="h-11 w-full rounded-2xl bg-ink/5" />
      </div>
      <div className="px-5 mt-5 flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-16 rounded-full bg-ink/5" />
        ))}
      </div>
      <div className="px-5 mt-5 space-y-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <QuoteCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/** Skeleton shown while a customer detail page is loading. */
export function ClientDetailSkeleton() {
  return (
    <div className="min-h-screen bg-paper">
      {/* Header placeholder */}
      <div className="px-5 pt-6 pb-2">
        <Skeleton className="h-3 w-20 bg-ink/10" />
        <Skeleton className="mt-2 h-7 w-40 bg-ink/10" />
      </div>

      {/* Stats grid */}
      <div className="px-5 grid grid-cols-2 gap-3">
        <div className="card-surface p-4 space-y-2">
          <Skeleton className="h-[10px] w-20 rounded-md bg-ink/5" />
          <Skeleton className="h-7 w-24 rounded-md bg-ink/5" />
        </div>
        <div className="card-surface p-4 space-y-2">
          <Skeleton className="h-[10px] w-20 rounded-md bg-ink/5" />
          <Skeleton className="h-7 w-24 rounded-md bg-ink/5" />
        </div>
      </div>

      {/* Summary card */}
      <div className="px-5 mt-3">
        <div className="card-surface p-4 flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full bg-ink/5 shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton className="h-4 w-40 rounded-md bg-ink/5" />
            <Skeleton className="h-3 w-52 rounded-md bg-ink/5" />
          </div>
        </div>
      </div>

      {/* Contact details card */}
      <div className="px-5 mt-4">
        <div className="card-surface p-5 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-9 w-9 rounded-full bg-ink/5 shrink-0" />
              <div className="min-w-0 space-y-1">
                <Skeleton className="h-[10px] w-12 rounded-md bg-ink/5" />
                <Skeleton className="h-4 w-32 rounded-md bg-ink/5" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* History list */}
      <div className="px-5 mt-6">
        <div className="flex items-center justify-between mb-2.5">
          <Skeleton className="h-6 w-28 rounded-md bg-ink/10" />
          <Skeleton className="h-8 w-24 rounded-full bg-ink/5" />
        </div>
        <div className="space-y-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card-surface p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-14 rounded-md bg-ink/5" />
                  <Skeleton className="h-4 w-16 rounded-full bg-ink/5" />
                </div>
                <Skeleton className="h-4 w-48 rounded-md bg-ink/5" />
                <Skeleton className="h-[11px] w-32 rounded-md bg-ink/5" />
              </div>
              <Skeleton className="h-5 w-16 rounded-md bg-ink/5 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
