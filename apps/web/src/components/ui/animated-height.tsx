import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '../../lib/cx';

/**
 * Lets its height glide when the content inside changes size (a view switch that swaps four cards for a chart),
 * instead of the page below jumping. Clips only while it moves, so tooltips aren't cut off at rest. The first
 * render takes the content's height at once; CSS turns the glide off under reduced motion.
 */
export function AnimatedHeight({ children, className }: { children: ReactNode; className?: string }) {
  const inner = useRef<HTMLDivElement>(null);
  const last = useRef<number | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [moving, setMoving] = useState(false);

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el || typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver(() => {
      const next = el.offsetHeight;
      if (last.current !== null && Math.abs(last.current - next) > 1) setMoving(true);
      last.current = next;
      setHeight(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={cx(
        'transition-[height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
        moving && 'overflow-hidden',
        className,
      )}
      style={height === null ? undefined : { height }}
      onTransitionEnd={(e) => e.target === e.currentTarget && setMoving(false)}
    >
      <div ref={inner}>{children}</div>
    </div>
  );
}
