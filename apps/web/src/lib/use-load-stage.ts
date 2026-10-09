import { useEffect, useState, useSyncExternalStore } from 'react';

/** After this long, the loading screen reassures: slow connections are normal. */
export const SLOW_AFTER_MS = 4_000;
/** After this long, it offers to try again. */
export const STUCK_AFTER_MS = 12_000;

export type LoadStage = 'loading' | 'slow' | 'stuck';

/**
 * One loading session can span several loading screens in a row (Clerk starting, then the account loading) and
 * the static first-paint skeleton in index.html. It continues across them: no second fade-in, and "slow" counts
 * from when loading really began.
 */
const session = { since: 0, endedAt: Number.NEGATIVE_INFINITY };
/** A screen that unmounts and is replaced within this long is the same session continuing. */
const CONTINUE_WITHIN_MS = 500;

/** Marks the start of a loading screen; returns whether it should appear at once (no fade) and when loading began. */
export function beginLoading(now = performance.now()): { instant: boolean; since: number } {
  if (now - session.endedAt < CONTINUE_WITHIN_MS) return { instant: true, since: session.since };
  // Straight after the first-paint skeleton (index.html): continue it, timed from page load.
  if (document.documentElement.dataset.splash === '1') {
    clearFirstPaint();
    session.since = 0;
    return { instant: true, since: 0 };
  }
  session.since = now;
  return { instant: false, since: now };
}

/** Marks the end of a loading screen, so one that follows straight after continues the session. */
export function endLoading(now = performance.now()) {
  session.endedAt = now;
}

/** How long loading has been going on, as a stage (see beginLoading). */
export function useLoadStage(since: number): LoadStage {
  const stageAt = (elapsed: number): LoadStage =>
    elapsed >= STUCK_AFTER_MS ? 'stuck' : elapsed >= SLOW_AFTER_MS ? 'slow' : 'loading';
  const [stage, setStage] = useState<LoadStage>(() => stageAt(performance.now() - since));
  useEffect(() => {
    const elapsed = performance.now() - since;
    const timers = [SLOW_AFTER_MS, STUCK_AFTER_MS]
      .filter((t) => t > elapsed)
      .map((t) => setTimeout(() => setStage(stageAt(performance.now() - since)), t - elapsed));
    return () => timers.forEach(clearTimeout);
  }, [since]);
  return stage;
}

/** Whether the browser thinks it is online, kept in sync. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (notify) => {
      window.addEventListener('online', notify);
      window.addEventListener('offline', notify);
      return () => {
        window.removeEventListener('online', notify);
        window.removeEventListener('offline', notify);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

/** The first screen React shows replaces the index.html skeleton; after that, loading screens fade in as usual. */
export function clearFirstPaint() {
  delete document.documentElement.dataset.splash;
}
