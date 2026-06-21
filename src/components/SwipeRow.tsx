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
 *
 * Accessibility:
 * - The action buttons live in the DOM at all times and are reachable by
 *   keyboard tab. When they receive focus, the row slides open so sighted
 *   keyboard users can see the action they're about to trigger.
 * - A visually-hidden hint announces the available swipe actions to screen
 *   readers.
 *
 * Haptics:
 * - Light tap when a swipe first crosses the action threshold (so the user
 *   feels the row "engage" before releasing).
 * - Light tap when the row snaps back without triggering an action.
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
  actionsLabel,
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
  /** Accessible label describing what the row is (e.g. "Actions for New request from Sam"). */
  actionsLabel?: string;
}) {
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const startX = useRef<number | null>(null);
  const startOffset = useRef(0);
  const moved = useRef(false);
  const crossedThreshold = useRef(false);

  const REVEAL = 88;
  const THRESHOLD = 40;

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    startX.current = e.clientX;
    startOffset.current = offset;
    moved.current = false;
    crossedThreshold.current = Math.abs(offset) >= THRESHOLD;
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (startX.current === null) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > 6) moved.current = true;
    const minX = onDelete ? -REVEAL - 20 : 0;
    const maxX = onChase ? REVEAL + 20 : 0;
    const next = Math.min(maxX, Math.max(minX, startOffset.current + dx));
    setOffset(next);

    // Haptic tick the moment the user crosses (or un-crosses) the action threshold.
    const past = Math.abs(next) >= THRESHOLD;
    if (past !== crossedThreshold.current) {
      crossedThreshold.current = past;
      if (past) feedback("tap");
    }
  }
  function onPointerUp() {
    if (startX.current === null) return;
    startX.current = null;
    if (onDelete && offset < -THRESHOLD) {
      setOffset(-REVEAL);
    } else if (onChase && offset > THRESHOLD) {
      setOffset(REVEAL);
    } else {
      if (offset !== 0) feedback("tap"); // snap-back haptic
      setOffset(0);
    }
  }
  function onPointerCancel() {
    startX.current = null;
    if (offset !== 0) feedback("tap");
    setOffset(0);
  }

  async function handleDelete() {
    if (busy || !onDelete) return;
    setBusy(true);
    feedback("warn");
    try {
      await onDelete();
      setOffset(0);
    } catch (e) {
      console.error("swipe delete failed", e);
      feedback("error");
      setOffset(0);
    } finally {
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

  // Build a short SR hint describing what swipes / buttons do for this row.
  const srHint = [
    onChase ? `Swipe right or activate the ${chaseLabel} button.` : null,
    onDelete ? `Swipe left or activate the ${confirmLabel} button.` : null,
  ].filter(Boolean).join(" ");

  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${className}`}
      role={actionsLabel ? "group" : undefined}
      aria-label={actionsLabel}
    >
      {srHint && <span className="sr-only">{srHint}</span>}
      {onChase && (
        <button
          type="button"
          onClick={handleChase}
          onFocus={() => setOffset(REVEAL)}
          onBlur={() => setOffset((o) => (o === REVEAL ? 0 : o))}
          disabled={busy}
          aria-label={chaseLabel}
          className={`absolute inset-y-0 left-0 flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 ${chaseClassName}`}
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
          onFocus={() => setOffset(-REVEAL)}
          onBlur={() => setOffset((o) => (o === -REVEAL ? 0 : o))}
          disabled={busy}
          aria-label={confirmLabel}
          className="absolute inset-y-0 right-0 flex items-center justify-center gap-1.5 bg-status-overdue text-paper text-xs font-semibold uppercase tracking-wider focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
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
            if (offset !== 0 && !moved.current) {
              feedback("tap");
              setOffset(0);
            }
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
