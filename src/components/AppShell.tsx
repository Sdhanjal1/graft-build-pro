import { Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PullToRefresh } from "@/components/PullToRefresh";

export function AppShell({
  children,
  onRefresh,
}: {
  children: React.ReactNode;
  onRefresh?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const handleRefresh = onRefresh ?? (() => router.invalidate());
  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-md min-h-screen pb-nav">
        <PullToRefresh onRefresh={handleRefresh}>{children}</PullToRefresh>
      </div>
    </div>
  );
}

type HeaderAction =
  | { label: string; to: string; search?: Record<string, unknown>; onClick?: never }
  | { label: string; onClick: () => void; to?: never; search?: never };

export function PageHeader({
  title,
  subtitle,
  back,
  right,
  action,
  crumbs,
  urgent = false,
}: {
  title: string;
  subtitle?: string;
  back?: string | boolean;
  right?: React.ReactNode;
  action?: HeaderAction;
  crumbs?: string[];
  urgent?: boolean;
  /** legacy — accepted but no longer differentiates */
  compact?: boolean;
}) {
  const showBack = back !== undefined && back !== false;
  const backTo = typeof back === "string" ? back : "/";

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [condensed, setCondensed] = useState(false);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setCondensed(!entry.isIntersecting),
      { threshold: 0, rootMargin: "0px 0px 0px 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  // Render crumb trail: last segment is the active title, earlier ones are muted.
  const trail = crumbs && crumbs.length > 0 ? crumbs : null;

  const ActionPill = action ? (
    action.to ? (
      <Link
        to={action.to}
        search={action.search as never}
        className="shrink-0 h-9 px-4 rounded-full bg-lime text-ink inline-flex items-center font-bold text-[12px] uppercase tracking-tight active:translate-y-0.5 active:shadow-none transition shadow-[0_3px_0_0_#9db23a]"
      >
        {action.label}
      </Link>
    ) : (
      <button
        type="button"
        onClick={action.onClick}
        className="shrink-0 h-9 px-4 rounded-full bg-lime text-ink inline-flex items-center font-bold text-[12px] uppercase tracking-tight active:translate-y-0.5 active:shadow-none transition shadow-[0_3px_0_0_#9db23a]"
      >
        {action.label}
      </button>
    )
  ) : null;

  return (
    <>
      <header
        className={[
          "sticky top-0 z-30 bg-ink text-paper relative overflow-hidden transition-[padding,border-radius] duration-200 motion-reduce:transition-none",
          condensed
            ? "rounded-b-[1rem] px-4 pt-2 pb-2"
            : "rounded-b-[2rem] px-5 pt-5 pb-8",
        ].join(" ")}
      >
        {!condensed && (
          <span
            aria-hidden
            className="absolute left-0 top-0 h-full w-1.5 bg-lime/60"
          />
        )}

        <div className="relative flex items-center gap-3">
          {showBack && (
            <Link
              to={backTo}
              className={[
                "shrink-0 rounded-full bg-paper/10 border border-paper/15 flex items-center justify-center transition-[height,width] duration-200 motion-reduce:transition-none",
                condensed ? "h-7 w-7" : "h-8 w-8",
              ].join(" ")}
              aria-label="Back"
            >
              <ChevronLeft className="h-4 w-4 text-paper" />
            </Link>
          )}

          <div className="flex-1 min-w-0">
            {trail && !condensed && (
              <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-paper/45 truncate">
                {trail.slice(0, -1).map((c, i) => (
                  <span key={i}>
                    {truncate(c, 18)}
                    <span aria-hidden className="mx-1.5 text-paper/30">/</span>
                  </span>
                ))}
                <span className="text-paper/70">
                  {truncate(trail[trail.length - 1], 18)}
                </span>
              </p>
            )}
            <h1
              className={[
                "text-lime uppercase leading-[0.95] tracking-tight truncate transition-[font-size] duration-200 motion-reduce:transition-none",
              ].join(" ")}
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: condensed ? "1.1rem" : "2rem",
              }}
            >
              {title}
            </h1>
            {subtitle && !condensed && (
              <span className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-paper/55 font-bold uppercase tracking-[0.18em] truncate">
                {urgent && (
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 rounded-full shrink-0 bg-status-overdue"
                  />
                )}
                <span className="truncate">{subtitle}</span>
              </span>
            )}
          </div>

          {!condensed && (right ?? ActionPill) && (
            <div className="shrink-0 self-center">{right ?? ActionPill}</div>
          )}
        </div>
      </header>

      {/* Sentinel just below the header — when it scrolls out, condense. */}
      <div ref={sentinelRef} aria-hidden className="h-px w-full" />
    </>
  );
}

function truncate(value: string, max: number) {
  if (!value) return value;
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
