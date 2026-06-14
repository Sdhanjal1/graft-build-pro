import { useEffect, useState } from "react";

/**
 * Returns true while a soft keyboard (or any UA virtual widget) is covering
 * a meaningful slice of the layout. We use it to hide the fixed BottomNav
 * so it doesn't float above the keyboard and obscure the focused input.
 *
 * Strategy: prefer `visualViewport` (accurate on iOS/Android Chrome). Fall back
 * to focus tracking on text-entry elements for older WebViews.
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const vv = window.visualViewport;

    const measure = () => {
      if (vv) {
        // Treat ≥ 150px of lost viewport height as "keyboard up". This avoids
        // false positives from address-bar collapse on scroll.
        const diff = window.innerHeight - vv.height;
        setOpen(diff > 150);
      }
    };

    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName;
      const editable = t.isContentEditable;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || editable) {
        // Honour input type — buttons, checkboxes, etc don't pop a keyboard.
        if (tag === "INPUT") {
          const type = (t as HTMLInputElement).type;
          const noKeyboard = ["button", "checkbox", "radio", "submit", "reset", "file", "color", "range"];
          if (noKeyboard.includes(type)) return;
        }
        setOpen(true);
      }
    };
    const onFocusOut = () => {
      // Defer so the next focus target (if any) can re-open.
      setTimeout(() => {
        const a = document.activeElement as HTMLElement | null;
        if (!a) return setOpen(false);
        const tag = a.tagName;
        if (!(tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || a.isContentEditable)) {
          setOpen(false);
        }
      }, 50);
    };

    if (vv) {
      vv.addEventListener("resize", measure);
      vv.addEventListener("scroll", measure);
      measure();
    }
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);

    return () => {
      if (vv) {
        vv.removeEventListener("resize", measure);
        vv.removeEventListener("scroll", measure);
      }
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return open;
}
