import { useEffect, useState } from "react";

/**
 * Shows a small notice when the app is running as an iOS standalone PWA
 * (added to Home Screen). iOS aggressively suspends background audio in
 * WebClip mode, so we ask the user to keep the app foregrounded while
 * recording.
 */
export function IOSStandaloneRecordingNotice({ active }: { active: boolean }) {
  const [isIOSStandalone, setIsIOSStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return;
    const ua = navigator.userAgent || "";
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    // iOS exposes navigator.standalone; non-iOS browsers don't.
    const standalone = (navigator as any).standalone === true;
    setIsIOSStandalone(isIOS && standalone);
  }, []);

  if (!isIOSStandalone || !active) return null;

  return (
    <p className="text-xs text-muted-foreground mt-2 text-center max-w-xs">
      Keep Quottr open while recording, iOS pauses audio if you switch apps or lock the screen.
    </p>
  );
}
