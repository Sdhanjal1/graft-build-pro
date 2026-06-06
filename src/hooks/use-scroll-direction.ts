import { useEffect, useState } from "react";

interface Options {
  /** Pixels of scroll past which "down" can hide things. Default 200. */
  threshold?: number;
  /** When within this many px of bottom, always treat as "up" (show bar). Default 80. */
  bottomReveal?: number;
}

/**
 * Tracks vertical scroll direction with hysteresis. Returns `true` when the
 * UI should be VISIBLE (top of page, scrolling up, near the bottom), and
 * `false` when it should hide (scrolling down past the threshold).
 */
export function useScrollVisible({ threshold = 200, bottomReveal = 80 }: Options = {}): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let lastY = window.scrollY;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - lastY;
        const nearBottom =
          window.innerHeight + y >= document.documentElement.scrollHeight - bottomReveal;

        if (y < threshold || nearBottom) {
          setVisible(true);
        } else if (dy > 6) {
          setVisible(false);
        } else if (dy < -6) {
          setVisible(true);
        }
        lastY = y;
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold, bottomReveal]);

  return visible;
}
