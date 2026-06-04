import { Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { QuottrWordmark } from "@/components/QuottrLogo";
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
      <div className="mx-auto max-w-md min-h-screen pb-28">
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
}: {
  title: string;
  subtitle?: string;
  back?: string | boolean;
  right?: React.ReactNode;
}) {
  
  const showBack = back !== undefined && back !== false;
  const backTo = typeof back === "string" ? back : "/";

  return (
    <header className="bg-ink text-paper rounded-b-[2rem] px-5 pt-7 pb-8 relative overflow-hidden">
      <span aria-hidden className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-lime/15 blur-2xl pointer-events-none" />
      <div className="mb-6 flex items-center justify-between relative">
        <QuottrWordmark className="text-[2.5rem] leading-none" />
        <span className="h-1.5 w-10 rounded-full bg-lime" />
      </div>
      <div className="flex items-end gap-3 relative">
        {showBack && (
          <Link
            to={backTo}
            className="h-10 w-10 -ml-1 mb-1 rounded-full bg-paper/10 border border-paper/15 flex items-center justify-center"
          >
            <ChevronLeft className="h-5 w-5 text-paper" />
          </Link>
        )}
        <div className="flex-1 min-w-0">
          {subtitle && (
            <p className="text-[10px] uppercase tracking-[0.2em] text-lime/90 font-bold mb-1">{subtitle}</p>
          )}
          <h1
            className="text-paper break-words leading-[0.85]"
            style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(2.75rem, 11vw, 3.75rem)", letterSpacing: "0.005em" }}
          >
            {title}
          </h1>
        </div>
        {right}
      </div>
    </header>
  );
}

