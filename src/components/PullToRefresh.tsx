import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
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
        feedback("tap");
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

  const fade = Math.min(1, pull / THRESHOLD);

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
        <div
          className="mb-3 flex items-center justify-center"
          style={{
            opacity: refreshing ? 1 : fade,
            transform: `scale(${0.85 + fade * 0.15})`,
            transition: refreshing ? "opacity 200ms ease" : "none",
          }}
        >
          {refreshing ? (
            <Loader2 className="h-5 w-5 animate-spin text-ink" />
          ) : (
            <span
              className="text-ink leading-none tracking-tight text-2xl"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              Quottr.
            </span>
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
