import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type RefObject,
} from 'react';

/** Whether motion should be kept to a minimum: the system setting, or "Reduce motion" in Settings (data-motion). */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  return (
    document.documentElement.dataset.motion === 'reduced' ||
    (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  );
}

/**
 * prefersReducedMotion as a hook that re-renders when either setting changes (the system's, or "Reduce motion" in
 * Settings), for components that choose between motion and a still rather than just shortening an animation.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeMotion, prefersReducedMotion, () => true);
}

function subscribeMotion(onChange: () => void): () => void {
  const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  media?.addEventListener('change', onChange);
  const observer = typeof MutationObserver === 'function' ? new MutationObserver(onChange) : null;
  observer?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
  return () => {
    media?.removeEventListener('change', onChange);
    observer?.disconnect();
  };
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/**
 * Numbers that glide to new values instead of jumping: returns `targets` eased in over `duration` ms each time they
 * change. A null target shows at once as null; a value appearing from null starts at `from` (e.g. the zero line).
 * Instant under reduced motion, in tests (no requestAnimationFrame), and on first render.
 */
export function useTweened(targets: readonly (number | null)[], from: number, duration = 450): (number | null)[] {
  const [shown, setShown] = useState<(number | null)[]>(() => [...targets]);
  const shownRef = useRef(shown);
  const key = targets.map((t) => (t === null ? 'n' : t.toFixed(3))).join(',');

  useEffect(() => {
    const start = shownRef.current;
    const set = (next: (number | null)[]) => {
      shownRef.current = next;
      setShown(next);
    };
    if (prefersReducedMotion() || typeof requestAnimationFrame !== 'function') return set([...targets]);
    const begin = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - begin) / duration);
      const e = easeOutCubic(t);
      set(
        targets.map((to, i) => {
          if (to === null) return null;
          const a = start[i] ?? from;
          return a + (to - a) * e;
        }),
      );
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // `key` stands for `targets`' values; `from` and `duration` only shape the next glide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return shown;
}

/**
 * A highlight that slides to the active option of a group of buttons (tabs, a segmented switch), rather than the
 * active background jumping. Mark each option with `data-option="<key>"`; place the returned style on an absolutely
 * positioned element inside the (relative) group. It follows wrapping and resizing; it doesn't slide in on first
 * paint, and CSS turns the slide off under reduced motion.
 */
export function useSlidingHighlight(
  group: RefObject<HTMLElement | null>,
  active: string,
): { style: CSSProperties; ready: boolean } {
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const el = group.current;
    if (!el) return;
    const measure = () => {
      const option = el.querySelector<HTMLElement>(`[data-option="${CSS.escape(active)}"]`);
      if (!option) return setBox(null);
      setBox({ x: option.offsetLeft, y: option.offsetTop, w: option.offsetWidth, h: option.offsetHeight });
    };
    measure();
    if (typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [group, active]);

  // Slide only after the first position is painted, so the highlight doesn't fly in from the corner.
  useEffect(() => {
    if (!box || ready) return;
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, [box, ready]);

  return {
    ready,
    style: box
      ? { transform: `translate(${box.x}px, ${box.y}px)`, width: box.w, height: box.h }
      : { opacity: 0, width: 0, height: 0 },
  };
}
