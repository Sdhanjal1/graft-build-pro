import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-md min-h-screen pb-28">{children}</div>
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
    <header className="px-5 pt-6 pb-4 flex items-start gap-3">
      {showBack && (
        <Link
          to={backTo}
          className="h-10 w-10 -ml-1 mt-1 rounded-full bg-card border border-border flex items-center justify-center"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
      )}
      <div className="flex-1 min-w-0">
        {subtitle && (
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{subtitle}</p>
        )}
        <h1 className="text-3xl leading-none mt-1 truncate">{title}</h1>
      </div>
      {right}
    </header>
  );
}
