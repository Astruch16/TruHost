import { Sparkles } from 'lucide-react';
import { cx } from '../../lib/cx';

/**
 * A clean to schedule: a gold sparkle in a small white ring. The same mark on the dashboard's next-7-days timeline,
 * the month calendar and their keys. Decorative: the text beside it (or a title) says what it is.
 */
export function CleanMark({ size = 'md', className }: { size?: 'sm' | 'md'; className?: string }) {
  return (
    <span
      aria-hidden
      className={cx(
        'grid shrink-0 place-items-center rounded-full bg-surface ring-1 ring-amber-mid',
        size === 'sm' ? 'size-4' : 'size-[18px]',
        className,
      )}
    >
      <Sparkles className={cx('text-amber-deep', size === 'sm' ? 'size-2.5' : 'size-3')} strokeWidth={2} />
    </span>
  );
}
