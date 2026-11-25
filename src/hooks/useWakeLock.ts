import { useEffect } from 'react';

/**
 * Keeps the screen on while `enabled` is true.
 *
 * The browser drops the lock whenever the page is hidden, so it is requested again each time
 * the page becomes visible. Browsers without the Screen Wake Lock API (iOS before 18.4 in a
 * Home Screen app) simply keep their own auto-lock behaviour.
 */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      return undefined;
    }

    let sentinel: WakeLockSentinel | null = null;
    let active = true;

    const request = async () => {
      if (document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return;
      try {
        const next = await navigator.wakeLock.request('screen');
        if (active) sentinel = next;
        else void next.release();
      } catch {
        // Refused (low battery mode, no user gesture yet): the next visibility change retries.
      }
    };

    const handleVisibility = () => {
      void request();
    };

    void request();
    document.addEventListener('visibilitychange', handleVisibility);
    // Some browsers only grant the lock after a user gesture, so a tap also retries.
    document.addEventListener('pointerdown', handleVisibility);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('pointerdown', handleVisibility);
      if (sentinel && !sentinel.released) void sentinel.release();
    };
  }, [enabled]);
}
