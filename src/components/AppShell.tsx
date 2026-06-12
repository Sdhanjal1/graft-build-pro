import { Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

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
      <div className="mx-auto max-w-md min-h-screen pb-24">
        <PullToRefresh onRefresh={handleRefresh}>{children}</PullToRefresh>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  back,
  right,
  compact = false,
}: {
  title: string;
  subtitle?: string;
  back?: string | boolean;
  right?: React.ReactNode;
  compact?: boolean;
}) {
  
  const showBack = back !== undefined && back !== false;
  const backTo = typeof back === "string" ? back : "/";

  if (compact) {
    return (
      <header className="bg-surface text-paper rounded-b-[1.5rem] px-5 pt-5 pb-4 relative overflow-hidden">
        <span aria-hidden className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-lime/15 blur-3xl pointer-events-none" />
        <span aria-hidden className="absolute left-0 top-0 h-full w-1.5 bg-lime" />
        <div className="relative flex items-start gap-3">
          {showBack && (
            <Link
              to={backTo}
              className="h-8 w-8 mt-0.5 -ml-0.5 shrink-0 rounded-full bg-paper/10 border border-paper/15 flex items-center justify-center"
              aria-label="Back"
            >
              <ChevronLeft className="h-4 w-4 text-paper" />
            </Link>
          )}
          <div className="flex-1 min-w-0">
            <h1
              className="text-paper uppercase leading-[0.95] tracking-[0.04em]"
              style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.9rem" }}
            >
              {title}
            </h1>
            {subtitle && (
              <span className="block mt-1 text-[11px] text-paper/55 font-medium">{subtitle}</span>
            )}
          </div>
          {right && <div className="shrink-0 pt-0.5">{right}</div>}
        </div>
      </header>
    );
  }


  return (
    <header className="bg-surface text-paper rounded-b-[1.5rem] px-5 pt-7 pb-6 relative overflow-hidden">
      <span aria-hidden className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-lime/15 blur-3xl pointer-events-none" />
      <span aria-hidden className="absolute left-0 top-0 h-full w-1.5 bg-lime" />

      {/* Brand bar — QUOTTR is the anchor */}
      <div className="relative flex items-end justify-between">
        <span
          className="text-lime leading-[0.8] tracking-tight"
          style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(3.5rem, 16vw, 5rem)" }}
        >
          Quottr.
        </span>
        {right && <div className="pb-2">{right}</div>}
      </div>

      {/* Hairline divider */}
      <div className="relative mt-4 h-px bg-paper/10" />

      {/* Secondary: screen title */}
      <div className="relative mt-3 flex items-center gap-3">
        {showBack && (
          <Link
            to={backTo}
            className="h-8 w-8 -ml-0.5 rounded-full bg-paper/10 border border-paper/15 flex items-center justify-center"
            aria-label="Back"
          >
            <ChevronLeft className="h-4 w-4 text-paper" />
          </Link>
        )}
        <h1
          className="text-paper/85 uppercase leading-none tracking-[0.08em]"
          style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.5rem" }}
        >
          {title}
        </h1>
        {subtitle && (
          <>
            <span aria-hidden className="h-1 w-1 rounded-full bg-paper/30" />
            <span className="text-[11px] text-paper/55 font-medium truncate">{subtitle}</span>
          </>
        )}
      </div>
    </header>
  );
}

