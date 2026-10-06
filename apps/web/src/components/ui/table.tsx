import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';
import { ErrorAlert } from './alert';
import { Skeleton } from './skeleton';

/** Scrolls horizontally on narrow screens instead of squashing columns. */
export function Table({ className, children, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table {...props} className={cx('w-full border-collapse text-left text-sm', className)}>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="border-b border-line text-xs font-semibold text-muted">{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-line-soft">{children}</tbody>;
}

export function Tr({
  className,
  interactive,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }) {
  return (
    <tr
      {...props}
      className={cx(interactive && 'transition-colors hover:bg-ground focus-within:bg-ground', className)}
    />
  );
}

export function Th({ className, align, ...props }: ThHTMLAttributes<HTMLTableCellElement> & { align?: 'right' }) {
  return (
    <th
      scope="col"
      {...props}
      className={cx(
        'px-3 py-2.5 font-semibold whitespace-nowrap first:pl-0 last:pr-0',
        align === 'right' && 'text-right',
        className,
      )}
    />
  );
}

export function Td({ className, align, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { align?: 'right' }) {
  return (
    <td
      {...props}
      className={cx(
        'px-3 py-3 align-middle text-ink first:pl-0 last:pr-0',
        align === 'right' && 'text-right',
        className,
      )}
    />
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
            <td colSpan={columns} className="py-3">
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
        <td colSpan={columns} className="py-3">
          <ErrorAlert error={error} />
        </td>
      </tr>
    );
  }
  if (empty) {
    return (
      <tr>
        <td colSpan={columns} className="py-8 text-center text-muted">
          {emptyMessage}
        </td>
      </tr>
    );
  }
  return null;
}
