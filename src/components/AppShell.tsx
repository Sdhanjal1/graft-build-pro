import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { QuottrWordmark } from "@/components/QuottrLogo";

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
    <header className="bg-ink text-paper rounded-b-3xl px-5 pt-5 pb-5">
      <div className="flex items-center justify-between mb-4">
        <QuottrWordmark className="text-2xl" />
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
          {subtitle && (
            <p className="text-[10px] uppercase tracking-widest text-paper/60 font-semibold">{subtitle}</p>
          )}
          <h1 className="text-3xl leading-tight mt-1 break-words text-paper">{title}</h1>
        </div>
        {right}
      </div>
    </header>
  );
}
