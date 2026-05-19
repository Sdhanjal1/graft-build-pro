import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { createSiteCapture } from "@/lib/site-captures";
import { mockProfile } from "@/lib/mock-data";

export const Route = createFileRoute("/capture/new")({
  component: NewCapturePage,
});

function NewCapturePage() {
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const c = await createSiteCapture({
          tradeType: mockProfile.trade_type,
          vatRegistered: mockProfile.vat_registered,
        });
        navigate({ to: "/capture/$captureId", params: { captureId: c.id }, replace: true });
      } catch (e) {
        console.error(e);
        navigate({ to: "/", replace: true });
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-dvh bg-ink text-paper flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-lime" />
    </div>
  );
}
