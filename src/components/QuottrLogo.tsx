import logo from "@/assets/quottr-logo.png";

export function QuottrLogo({ className = "h-8 w-auto" }: { className?: string }) {
  return <img src={logo} alt="Quottr." className={className} />;
}
