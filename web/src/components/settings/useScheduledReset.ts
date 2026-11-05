import { useCallback, useEffect, useRef } from 'react';

/** Clears the previous timer before scheduling a new one, and on unmount. */
export function useScheduledReset() {
  const timerRef = useRef<number | null>(null);

  const clearScheduledReset = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleReset = useCallback((reset: () => void, delayMs: number) => {
    clearScheduledReset();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      reset();
    }, delayMs);
  }, [clearScheduledReset]);

  useEffect(() => clearScheduledReset, [clearScheduledReset]);

  return scheduleReset;
}
