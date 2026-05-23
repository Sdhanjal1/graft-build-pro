import { useEffect, useRef, useState } from "react";
import { Loader2, ArrowDown } from "lucide-react";
import { feedback } from "@/lib/feedback";

const THRESHOLD = 70;
const MAX_PULL = 120;

export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => void | Promise<void>;
  children: React.ReactNode;
}) {
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const triggered = useRef(false);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0 || refreshing) return;
      startY.current = e.touches[0].clientY;
      triggered.current = false;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (startY.current == null || refreshing) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        setPull(0);
        return;
      }
      const eased = Math.min(MAX_PULL, dy * 0.5);
      setPull(eased);
      if (eased >= THRESHOLD && !triggered.current) {
        triggered.current = true;
        feedback("light");
      }
    };
    const onTouchEnd = async () => {
      if (startY.current == null) return;
      const shouldRefresh = pull >= THRESHOLD;
      startY.current = null;
      if (shouldRefresh) {
        setRefreshing(true);
        setPull(THRESHOLD);
        try {
          await onRefresh();
          feedback("success");
        } catch {
          feedback("error");
        } finally {
          setRefreshing(false);
          setPull(0);
        }
      } else {
        setPull(0);
      }
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [pull, refreshing, onRefresh]);

  const ready = pull >= THRESHOLD;

  return (
    <>
      <div
        aria-hidden
        className="fixed top-0 left-0 right-0 flex items-end justify-center pointer-events-none z-50"
        style={{
          height: pull,
          transition: refreshing || pull === 0 ? "height 200ms ease" : "none",
        }}
      >
        <div className="mb-2 h-9 w-9 rounded-full bg-ink text-paper flex items-center justify-center shadow-lg">
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowDown
              className="h-4 w-4 transition-transform"
              style={{ transform: ready ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          )}
        </div>
      </div>
      <div
        style={{
          transform: `translateY(${pull}px)`,
          transition: refreshing || pull === 0 ? "transform 200ms ease" : "none",
        }}
      >
        {children}
      </div>
    </>
  );
}
