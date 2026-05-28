import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  shimmer?: boolean;
}

function Skeleton({ className, shimmer = true, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-md",
        shimmer
          ? "animate-shimmer bg-gradient-to-r from-transparent via-foreground/10 to-transparent bg-[length:200%_100%]"
          : "animate-pulse bg-primary/10",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
