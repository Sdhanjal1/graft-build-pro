import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";

interface UseAutoSaveOptions<T> {
  /** Called after the debounce window with the latest value. */
  onSave: (value: T) => Promise<void> | void;
  /** Debounce window in ms before `onSave` fires. Default 500. */
  debounceMs?: number;
  /** Toast title shown on save failure. Default "Couldn't save". */
  errorTitle?: string;
  /** Fallback error message when the thrown error has none. */
  errorMessage?: string;
  /** How long to keep `isSaved` true after a successful save (ms). Default 2000. */
  successDuration?: number;
  /** Show a toast on success. Default false (the inline indicator is usually enough). */
  toastOnSuccess?: boolean;
  /** Toast title shown on save success when `toastOnSuccess` is true. */
  successTitle?: string;
}

interface UseAutoSaveReturn<T> {
  isSaving: boolean;
  isSaved: boolean;
  error: string | null;
  /** Call with the new value. Debounces, then runs `onSave`. */
  handleChange: (value: T) => void;
  /** Force an immediate save of `value`, bypassing the debounce. */
  flush: (value: T) => Promise<void>;
  /** Cancel any pending save (e.g. on unmount before navigation). */
  cancel: () => void;
}

/**
 * Reusable auto-save hook with debounce, in-flight + success state, and
 * error toasting via sonner. Pair with <SaveIndicator /> for visual feedback.
 *
 * Example:
 *   const { isSaving, isSaved, handleChange } = useAutoSave<string>({
 *     onSave: async (v) => updateUserProfile({ name: v }),
 *   });
 *   <input onChange={(e) => { setName(e.target.value); handleChange(e.target.value); }} />
 *   <SaveIndicator isSaving={isSaving} isSaved={isSaved} />
 */
export function useAutoSave<T = unknown>({
  onSave,
  debounceMs = 500,
  errorTitle = "Couldn't save",
  errorMessage = "Please try again.",
  successDuration = 2000,
  toastOnSuccess = false,
  successTitle = "Saved",
}: UseAutoSaveOptions<T>): UseAutoSaveReturn<T> {
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep latest onSave in a ref so the debounced closure always calls the
  // freshest version without re-creating handlers on every render.
  const onSaveRef = useRef(onSave);
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

  const runSave = useCallback(async (value: T) => {
    setError(null);
    setIsSaving(true);
    try {
      await onSaveRef.current(value);
      setIsSaved(true);
      if (toastOnSuccess) toast.success(successTitle);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = setTimeout(() => setIsSaved(false), successDuration);
    } catch (err) {
      const message = err instanceof Error ? err.message : errorMessage;
      setError(message);
      toast.error(errorTitle, { description: message });
    } finally {
      setIsSaving(false);
    }
  }, [errorMessage, errorTitle, successDuration, successTitle, toastOnSuccess]);

  const cancel = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  const handleChange = useCallback((value: T) => {
    setError(null);
    setIsSaved(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void runSave(value);
    }, debounceMs);
  }, [debounceMs, runSave]);

  const flush = useCallback(async (value: T) => {
    cancel();
    await runSave(value);
  }, [cancel, runSave]);

  // Clean up timers on unmount.
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
  }, []);

  return { isSaving, isSaved, error, handleChange, flush, cancel };
}
