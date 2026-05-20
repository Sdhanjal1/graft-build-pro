type Size = "sm" | "md" | "lg" | "xl";

const SIZES: Record<Size, string> = {
  sm: "h-9 w-9 text-[11px]",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-base",
  xl: "h-24 w-24 text-xl",
};

function initialsFrom(name: string): string {
  const cleaned = (name || "").replace(/&/g, " and ").trim();
  if (!cleaned) return "Q";
  const words = cleaned.split(/\s+/).filter(Boolean);
  // For "Cosy Plumbing and Heating" -> "CP&H"
  const letters = words.slice(0, 3).map((w) => w[0]?.toUpperCase() ?? "").join("");
  return (letters || cleaned[0] || "Q").slice(0, 4).replace(/AND/g, "&");
}

export function BusinessLogo({
  logoUrl,
  businessName,
  size = "md",
  className = "",
}: {
  logoUrl?: string | null;
  businessName: string;
  size?: Size;
  className?: string;
}) {
  const sized = SIZES[size];
  if (logoUrl) {
    return (
      <div className={`${sized} rounded-2xl overflow-hidden bg-white border border-border shrink-0 ${className}`}>
        <img src={logoUrl} alt={`${businessName} logo`} className="h-full w-full object-contain" />
      </div>
    );
  }
  return (
    <div
      className={`${sized} rounded-full bg-lime text-ink flex items-center justify-center font-extrabold tracking-tight shrink-0 ${className}`}
      aria-label={`${businessName} logo`}
    >
      {initialsFrom(businessName)}
    </div>
  );
}
