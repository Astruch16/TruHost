import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';

/**
 * One setting inside a card: an icon tile, a title and a line of explanation on the left, its status or control
 * on the right (below on narrow screens). Rows are separated by a hairline.
 */
export function SettingRow({
  icon,
  title,
  titleId,
  description,
  status,
  children,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  titleId?: string;
  description?: ReactNode;
  /** A pill next to the title, e.g. "On". */
  status?: ReactNode;
  /** The control(s). */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'flex flex-col gap-3 border-t border-line-soft py-4 first:border-t-0 first:pt-0 last:pb-0 @xl/content:flex-row @xl/content:items-center @xl/content:gap-5',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3.5">
        {icon && (
          <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-ground text-ink [&>svg]:size-[1.15rem]">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id={titleId} className="font-semibold text-ink">
              {title}
            </h3>
            {status}
          </div>
          {description && <div className="mt-0.5 text-sm text-muted">{description}</div>}
        </div>
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2 @xl/content:justify-end">{children}</div>}
    </div>
  );
}
