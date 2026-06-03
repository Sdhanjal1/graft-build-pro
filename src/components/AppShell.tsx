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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const showBack = back !== undefined && back !== false;
  const backTo = typeof back === "string" ? back : "/";

  return (
    <header className="bg-ink text-paper rounded-b-3xl px-5 pt-6 pb-6">
      <div className="mb-5">
        <QuottrWordmark className="text-[2.25rem] leading-none" />
      </div>
      <div className="flex items-start gap-3">
        {showBack && (
          <Link
            to={backTo}
            className="h-10 w-10 -ml-1 mt-1 rounded-full bg-paper/10 border border-paper/15 flex items-center justify-center"
          >
            <ChevronLeft className="h-5 w-5 text-paper" />
          </Link>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl leading-tight break-words text-paper">{title}</h1>
          {subtitle && (
            <p className="text-xs text-paper/55 mt-1">{subtitle}</p>
          )}
        </div>
        {right}
      </div>
    </header>
  );
}

