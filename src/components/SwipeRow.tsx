import { useRef, useState, type ReactNode, type PointerEvent, type ComponentType } from "react";
import { Trash2, Send } from "lucide-react";
import { feedback } from "@/lib/feedback";

/**
 * Swipe row. Swipe LEFT to reveal a destructive action (delete).
 * Optionally, swipe RIGHT to reveal a positive action (e.g. send chaser).
 *
 * `onDelete` is optional — when omitted, left-swipe is disabled and only the
 * right-swipe (chase) action is available. This is useful for rows that should
 * never be destroyed (e.g. message threads, where deleting would lose history).
 */
export function SwipeRow({
  children,
  onDelete,
  onChase,
  confirmLabel = "Delete",
  chaseLabel = "Chase",
  chaseIcon: ChaseIcon = Send,
  chaseClassName = "bg-lime text-ink",
  className = "",
}: {
  children: ReactNode;
  onDelete?: () => void | Promise<void>;
  onChase?: () => void | Promise<void>;
  confirmLabel?: string;
  chaseLabel?: string;
  chaseIcon?: ComponentType<{ className?: string }>;
  /** Tailwind classes for the chase action background + text. */
  chaseClassName?: string;
  className?: string;
}) {
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const startX = useRef<number | null>(null);
  const startOffset = useRef(0);
  const moved = useRef(false);

  const REVEAL = 88;
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
    const minX = onDelete ? -REVEAL - 20 : 0;
    const maxX = onChase ? REVEAL + 20 : 0;
    const next = Math.min(maxX, Math.max(minX, startOffset.current + dx));
    setOffset(next);
  }
  function onPointerUp() {
    if (startX.current === null) return;
    startX.current = null;
    if (onDelete && offset < -THRESHOLD) setOffset(-REVEAL);
    else if (onChase && offset > THRESHOLD) setOffset(REVEAL);
    else setOffset(0);
  }
  function onPointerCancel() {
    startX.current = null;
    setOffset(0);
  }

  async function handleDelete() {
    if (busy || !onDelete) return;
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

  async function handleChase() {
    if (busy || !onChase) return;
    setBusy(true);
    feedback("success");
    try {
      await onChase();
      setOffset(0);
    } catch (e) {
      console.error("swipe chase failed", e);
      feedback("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`}>
      {onChase && (
        <button
          type="button"
          onClick={handleChase}
          disabled={busy}
          aria-label={chaseLabel}
          className={`absolute inset-y-0 left-0 flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider ${chaseClassName}`}
          style={{ width: 88 }}
        >
          <ChaseIcon className="h-4 w-4" />
          {chaseLabel}
        </button>
      )}
      {onDelete && (
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
      )}
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
          position: "relative",
          zIndex: 1,
          background: "var(--background, transparent)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
