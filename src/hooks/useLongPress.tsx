import { useCallback, useRef, type PointerEvent } from "react";
import { feedback } from "@/lib/feedback";

/**
 * Long-press handler that fires after `delay` ms of a held pointer.
 * Cancels on movement (>8px), pointer up, leave, or cancel — so it doesn't
 * conflict with scrolling or horizontal swipe gestures.
 */
export function useLongPress(onLongPress: () => void, delay = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    start.current = null;
  }, []);

  const onPointerDown = useCallback(
    (e: PointerEvent) => {
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        fired.current = true;
        feedback("warn");
        onLongPress();
      }, delay);
    },
    [delay, onLongPress],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!start.current) return;
      const dx = e.clientX - start.current.x;
      const dy = e.clientY - start.current.y;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clear();
    },
    [clear],
  );

  const onPointerUp = useCallback(() => clear(), [clear]);
  const onPointerLeave = useCallback(() => clear(), [clear]);
  const onPointerCancel = useCallback(() => clear(), [clear]);

  /** True if the most recent gesture fired the long-press. Use to suppress a follow-up click. */
  const didLongPress = useCallback(() => fired.current, []);
  const resetLongPress = useCallback(() => {
    fired.current = false;
  }, []);

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerLeave,
      onPointerCancel,
    },
    didLongPress,
    resetLongPress,
  };
}
