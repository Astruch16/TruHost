import { cx } from '../../lib/cx';

/** Placeholder block while data loads. Static (no shimmer) so it never fights reduced-motion. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx('rounded-control-sm bg-line-soft', className)} />;
}

/** Full-area loading state with an accessible label. */
export function LoadingBlock({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-3">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
    </div>
  );
}
