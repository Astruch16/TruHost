import { LoaderCircle } from 'lucide-react';
import { cx } from '../../lib/cx';

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <LoaderCircle
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'status' : undefined}
      className={cx('size-4 motion-safe:animate-spin', className)}
    />
  );
}
