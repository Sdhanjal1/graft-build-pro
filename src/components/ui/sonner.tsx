import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Themed Sonner — matches the ink/paper/lime system.
 * - Position: top-center on mobile so toasts don't fight the bottom nav.
 * - Success → lime accent border. Error → status-overdue accent.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      position="top-center"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-ink group-[.toaster]:text-paper group-[.toaster]:border group-[.toaster]:border-paper/10 group-[.toaster]:shadow-[0_10px_28px_-12px_rgba(0,0,0,0.45)] group-[.toaster]:rounded-2xl",
          description: "group-[.toast]:text-paper/65",
          actionButton: "group-[.toast]:bg-lime group-[.toast]:text-ink group-[.toast]:rounded-full",
          cancelButton: "group-[.toast]:bg-paper/10 group-[.toast]:text-paper/80 group-[.toast]:rounded-full",
          success: "group-[.toaster]:border-l-4 group-[.toaster]:border-l-lime",
          error: "group-[.toaster]:border-l-4 group-[.toaster]:border-l-status-overdue",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
