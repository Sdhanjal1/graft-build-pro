import { useRef, useState, type ReactNode, type PointerEvent } from "react";
import { Trash2 } from "lucide-react";
import { feedback } from "@/lib/feedback";

/**
 * Swipe-to-delete row. Drag the content left to reveal a delete action.
 * Tap the red action to confirm. Releasing without crossing the threshold snaps back.
 */
export function SwipeRow({
  children,
  onDelete,
  confirmLabel = "Delete",
  className = "",
}: {
  children: ReactNode;
  onDelete: () => void | Promise<void>;
  confirmLabel?: string;
  className?: string;
}) {
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const startX = useRef<number | null>(null);
  const startOffset = useRef(0);
  const moved = useRef(false);

  const REVEAL = 88; // width of action
  const THRESHOLD = 40;

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    startX.current = e.clientX;
    startOffset.current = offset;
    moved.current = false;
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (startX.current === null) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > 6) moved.current = true;
    const next = Math.min(0, Math.max(-REVEAL - 20, startOffset.current + dx));
    setOffset(next);
  }
  function onPointerUp() {
    if (startX.current === null) return;
    startX.current = null;
    setOffset(offset < -THRESHOLD ? -REVEAL : 0);
  }
  function onPointerCancel() {
    startX.current = null;
    setOffset(0);
  }

  async function handleDelete() {
    if (busy) return;
    setBusy(true);
    feedback("warn");
    try {
      await onDelete();
    } catch (e) {
      console.error("swipe delete failed", e);
      feedback("error");
      setOffset(0);
      setBusy(false);
    }
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`}>
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy}
        aria-label={confirmLabel}
        className="absolute inset-y-0 right-0 flex items-center justify-center gap-1.5 bg-status-overdue text-paper text-xs font-semibold uppercase tracking-wider"
        style={{ width: 88 }}
      >
        <Trash2 className="h-4 w-4" />
        {confirmLabel}
      </button>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClickCapture={(e) => {
          if (moved.current || offset !== 0) {
            e.preventDefault();
            e.stopPropagation();
            if (offset !== 0 && !moved.current) setOffset(0);
          }
        }}
        style={{
          transform: `translateX(${offset}px)`,
          transition: startX.current === null ? "transform 200ms ease" : "none",
          touchAction: "pan-y",
        }}
      >
        {children}
      </div>
    </div>
  );
}
