import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { pillDotStyles, pillStyles, type PillLook, type PillTone } from '../../lib/styles';

/**
 * A pill: a dot (or an icon) and a label on a soft tint of its tone. Every status, role and label chip in the portals
 * is one. `pulse` is for what's happening right now (a clean in progress): the dot sends out a slow ring, which stops
 * under reduced motion. Dark for the urgent ("Out") and top-level labels; `glass` on the deep green.
 */
export function Pill({
  tone = 'neutral',
  size,
  glass = false,
  pulse = false,
  icon,
  dot = true,
  className,
  children,
}: PillLook & {
  tone?: PillTone;
  pulse?: boolean;
  /** In place of the dot (a key for "You own this"). Decorative. */
  icon?: ReactNode;
  /** Off for plain labels (a property's layout). */
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={cx(pillStyles(tone, { size, glass }), className)}>
      {icon ? (
        <span aria-hidden className="-ml-0.5 flex shrink-0 [&>svg]:size-3.5">
          {icon}
        </span>
      ) : (
        dot && (
          <span aria-hidden className="relative flex shrink-0">
            {pulse && (
              <span
                data-pulse
                className={cx(
                  pillDotStyles(tone, glass),
                  'absolute inset-0 ring-0 motion-safe:animate-[pill-pulse_1.8s_cubic-bezier(0,0,0.2,1)_infinite]',
                )}
              />
            )}
            <span className={pillDotStyles(tone, glass)} />
          </span>
        )
      )}
      {children}
    </span>
  );
}
