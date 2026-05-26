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
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[92px] w-full rounded-2xl bg-ink/5" />
        ))}
      </div>
    </div>
  );
}
