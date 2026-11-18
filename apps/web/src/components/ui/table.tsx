import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';
import { ErrorAlert } from './alert';
import { Skeleton } from './skeleton';

/**
 * Scrolls horizontally on narrow screens instead of squashing columns. The scroller is `relative` so absolutely
 * positioned content (e.g. a screen-reader-only "Actions" header) stays inside it rather than widening the page.
 * Every cell has side padding, and the table reaches that far into its container's padding (`-mx-3`), so text lines
 * up with the content around it while a hovered row's highlight has room either side and rounded ends. Borders are
 * separate (not collapsed) because cells can't be rounded otherwise.
 */
export function Table({ className, children, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="scroll-area relative -mx-3 overflow-x-auto">
      <table {...props} className={cx('w-full border-separate border-spacing-0 text-left text-sm', className)}>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="text-xs font-semibold text-muted">{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  // Hairlines between rows, drawn on the cells (rows can't have borders when borders are separate).
  return <tbody className="[&>tr+tr>td]:border-t [&>tr+tr>td]:border-line-soft">{children}</tbody>;
}

export function Tr({
  className,
  interactive,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }) {
  return (
    <tr
      {...props}
      className={cx(
        // The highlight is painted on the cells so the row's ends can be rounded.
        interactive &&
          '*:transition-colors *:first:rounded-l-xl *:last:rounded-r-xl hover:*:bg-ground focus-within:*:bg-ground',
        className,
      )}
    />
  );
}

export function Th({ className, align, ...props }: ThHTMLAttributes<HTMLTableCellElement> & { align?: 'right' }) {
  return (
    <th
      scope="col"
      {...props}
      className={cx(
        'border-b border-line px-3 py-2.5 font-semibold whitespace-nowrap',
        align === 'right' && 'text-right',
        className,
      )}
    />
  );
}

export function Td({ className, align, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { align?: 'right' }) {
  return (
    <td {...props} className={cx('px-3 py-3 align-middle text-ink', align === 'right' && 'text-right', className)} />
  );
}

/**
 * Loading, error and empty rows for a table body. Render it in place of rows; it returns null once there is data.
 */
export function TableState({
  columns,
  loading,
  error,
  empty,
  emptyMessage = 'Nothing here yet.',
}: {
  columns: number;
  loading: boolean;
  error: unknown;
  empty: boolean;
  emptyMessage?: ReactNode;
}) {
  if (loading) {
    return (
      <>
        {[0, 1, 2].map((i) => (
          <tr key={i} aria-hidden>
            <td colSpan={columns} className="px-3 py-3">
              <Skeleton className="h-5" />
            </td>
          </tr>
        ))}
        <tr className="sr-only">
          <td role="status">Loading</td>
        </tr>
      </>
    );
  }
  if (error) {
    return (
      <tr>
        <td colSpan={columns} className="px-3 py-3">
          <ErrorAlert error={error} />
        </td>
      </tr>
    );
  }
  if (empty) {
    return (
      <tr>
        <td colSpan={columns} className="px-3 py-8 text-center text-muted">
          {emptyMessage}
        </td>
      </tr>
    );
  }
  return null;
}
