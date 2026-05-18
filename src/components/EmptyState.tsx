import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  icon: LucideIcon;
  title: string;
  body?: ReactNode;
  cta?: { label: string; to: string };
  tone?: "default" | "celebrate";
};

export function EmptyState({ icon: Icon, title, body, cta, tone = "default" }: Props) {
  const isCelebrate = tone === "celebrate";
  return (
    <div className="card-surface px-6 py-10 text-center flex flex-col items-center">
      <div
        className={`h-14 w-14 rounded-full flex items-center justify-center mb-4 ${
          isCelebrate ? "bg-lime/30 text-ink" : "bg-secondary text-muted-foreground"
        }`}
        aria-hidden
      >
        <Icon className="h-6 w-6" />
      </div>
      <p className="font-semibold text-base text-ink">{title}</p>
      {body && <p className="text-xs text-muted-foreground mt-1.5 max-w-[28ch]">{body}</p>}
      {cta && (
        <Link
          to={cta.to}
          className="mt-5 inline-flex items-center bg-lime text-ink rounded-full px-5 py-2.5 text-xs font-bold active:scale-95 transition"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
