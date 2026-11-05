import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';

/**
 * Top-level content card (18px radius). Use `inner` for cards nested inside a card (14px). The header (title,
 * description, actions) is set off from the content by a hairline across the card.
 */
export function Card({
  title,
  description,
  actions,
  inner = false,
  className,
  tour,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  inner?: boolean;
  className?: string;
  /** Anchor for a welcome tour step (`data-tour`). */
  tour?: string;
  children?: ReactNode;
}) {
  const hasHeader = title || description || actions;
  return (
    <section
      data-tour={tour}
      className={cx(
        'border bg-surface',
        inner
          ? 'rounded-inner border-line p-4'
          : 'rounded-card border-line-soft p-5 @2xl/content:p-6 @[100rem]/content:p-7',
        className,
      )}
    >
      {hasHeader && (
        <header
          className={cx(
            'flex flex-wrap items-start justify-between gap-3',
            // With content below, a hairline under the header runs to the card's edges, so the header reads as a band.
            Boolean(children) &&
              (inner
                ? '-mx-4 mb-4 border-b border-line-soft px-4 pb-3'
                : '-mx-5 mb-5 border-b border-line-soft px-5 pb-4 @2xl/content:-mx-6 @2xl/content:px-6 @[100rem]/content:-mx-7 @[100rem]/content:px-7'),
          )}
        >
          <div className="min-w-0">
            {title && (
              <h2
                className={cx(
                  'font-display font-semibold tracking-[-0.01em] text-ink',
                  inner ? 'text-lg' : 'text-[1.375rem] leading-tight',
                )}
              >
                {title}
              </h2>
            )}
            {description && <p className="mt-1 text-[13px] leading-relaxed text-muted">{description}</p>}
          </div>
          {actions && <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
