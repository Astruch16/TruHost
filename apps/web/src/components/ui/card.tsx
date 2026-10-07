import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';

/** Top-level content card (18px radius). Use `inner` for cards nested inside a card (14px). */
export function Card({
  title,
  description,
  actions,
  inner = false,
  className,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  inner?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const hasHeader = title || description || actions;
  return (
    <section
      className={cx(
        'border bg-surface',
        inner
          ? 'rounded-inner border-line p-4'
          : 'rounded-card border-line-soft p-5 @2xl/content:p-6 @[100rem]/content:p-7',
        className,
      )}
    >
      {hasHeader && (
        <header className={cx('flex flex-wrap items-start justify-between gap-3', children ? 'mb-4' : undefined)}>
          <div className="min-w-0">
            {title && <h2 className="text-lg font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
