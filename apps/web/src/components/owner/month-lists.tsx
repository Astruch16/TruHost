import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, FileText } from 'lucide-react';
import { ExpenseCategoryIcon } from '../illustrations/category-icons';
import { useApi } from '../../lib/api-context';
import { stayStyle } from '../../lib/calendar';
import { cx } from '../../lib/cx';
import { categoryLabel, kindLabel } from '../../lib/format';
import { formatCents } from '../../lib/money';
import { monthLabel, monthRange, shortDate } from '../../lib/months';
import { usePrefetchAdjacentMonths } from '../../lib/month-prefetch';
import { queries } from '../../lib/queries';
import { updatingStyles } from '../../lib/styles';
import { openFile } from '../../lib/upload';
import { ErrorAlert, LoadError } from '../ui/alert';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Pill } from '../ui/pill';
import { Skeleton } from '../ui/skeleton';

/** The month's stays, coloured by where they were booked (as on the calendar), with what each earned the owner. */
export function OwnerStays({ propertyId, month }: { propertyId: string; month: string }) {
  const api = useApi();
  const bookings = useQuery(queries.propertyBookings(api, propertyId, monthRange(month)));
  usePrefetchAdjacentMonths(month, (m) => queries.propertyBookings(api, propertyId, monthRange(m)), bookings.isSuccess);
  const items = bookings.data?.items ?? [];
  const shown = useShownMonth(month, bookings.data !== undefined && !bookings.isPlaceholderData);
  return (
    <Card title="Stays" description={monthLabel(month)}>
      {bookings.error ? (
        <LoadError what="stays" onRetry={() => void bookings.refetch()} retrying={bookings.isFetching} />
      ) : !bookings.data ? (
        <Skeleton className="h-32" />
      ) : items.length === 0 ? (
        <EmptyMonth key={shown}>No stays in {monthLabel(shown)}.</EmptyMonth>
      ) : (
        <ul
          key={shown}
          aria-busy={bookings.isPlaceholderData || undefined}
          className={cx('flex min-h-48 animate-fade-in flex-col', updatingStyles(bookings.isPlaceholderData))}
        >
          {items.map((b) => {
            const style = stayStyle(b);
            const cancelled = b.status === 'CANCELLED';
            return (
              <li key={b.id} className="flex items-center gap-4 border-b border-line-soft py-3 last:border-b-0">
                <span
                  aria-hidden
                  className={cx('h-10 w-1.5 shrink-0 rounded-full', style.swatch, cancelled && 'opacity-40')}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={cx(
                      'figure flex flex-wrap items-center gap-1.5 font-semibold text-ink',
                      cancelled && 'text-muted line-through',
                    )}
                  >
                    {shortDate(b.checkInDate)} <ArrowRight aria-label="to" className="size-3.5 text-muted" />{' '}
                    {shortDate(b.checkOutDate)}
                  </p>
                  <p className="text-sm text-muted">
                    {b.nights} night{b.nights === 1 ? '' : 's'} · {b.kind === 'GUEST' ? style.label : kindLabel(b.kind)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {cancelled ? (
                    <Pill tone="neutral">Cancelled</Pill>
                  ) : b.ownerGrossCents != null ? (
                    <>
                      <p className="figure font-semibold text-ink">{formatCents(b.ownerGrossCents)}</p>
                      <p className="text-xs text-muted">your gross</p>
                    </>
                  ) : b.kind === 'GUEST' && !b.complete ? (
                    <span className="text-sm text-muted">Payout pending</span>
                  ) : (
                    <span className="text-sm text-muted">—</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** The month's owner-paid expenses, with their receipts. */
export function OwnerExpenses({ propertyId, month }: { propertyId: string; month: string }) {
  const api = useApi();
  const [viewError, setViewError] = useState<unknown>(null);
  const expenses = useQuery(queries.propertyExpenses(api, propertyId, monthRange(month)));
  usePrefetchAdjacentMonths(month, (m) => queries.propertyExpenses(api, propertyId, monthRange(m)), expenses.isSuccess);
  const items = expenses.data?.items ?? [];
  const shown = useShownMonth(month, expenses.data !== undefined && !expenses.isPlaceholderData);
  return (
    <Card title="Expenses" description={monthLabel(month)}>
      <ErrorAlert error={viewError} />
      {expenses.error ? (
        <LoadError what="expenses" onRetry={() => void expenses.refetch()} retrying={expenses.isFetching} />
      ) : !expenses.data ? (
        <Skeleton className="h-24" />
      ) : items.length === 0 ? (
        <EmptyMonth key={shown}>No expenses in {monthLabel(shown)}.</EmptyMonth>
      ) : (
        <ul
          key={shown}
          aria-busy={expenses.isPlaceholderData || undefined}
          className={cx('flex min-h-48 animate-fade-in flex-col', updatingStyles(expenses.isPlaceholderData))}
        >
          {items.map((e) => (
            <li key={e.id} className="flex items-center gap-4 border-b border-line-soft py-3 last:border-b-0">
              <ExpenseCategoryIcon category={e.category} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 font-semibold text-ink">{e.description}</p>
                <p className="truncate text-sm text-muted">
                  {[shortDate(e.incurredOn), categoryLabel(e.category), e.vendor].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="figure font-semibold text-ink">{formatCents(e.amountCents)}</span>
                {e.receipts.length ? (
                  e.receipts.map((r) => (
                    <Button
                      key={r.id}
                      variant="quiet"
                      size="sm"
                      className="px-2"
                      aria-label={`View the receipt for ${e.description}`}
                      onClick={() => void openFile(api, r.fileId).catch(setViewError)}
                    >
                      <FileText aria-hidden className="size-4" />
                    </Button>
                  ))
                ) : (
                  <span className="text-xs text-muted">Receipt pending</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * The month whose rows are on screen: the previous one while the chosen month loads (shown dimmed), then the chosen
 * one. Keying the list by it fades the new month's rows in once, when they arrive.
 */
function useShownMonth(month: string, settled: boolean) {
  const [shown, setShown] = useState(month);
  if (settled && shown !== month) setShown(month);
  return shown;
}

/** A month with nothing in it: as tall as a short list, so stepping between months doesn't jump. */
function EmptyMonth({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-48 animate-fade-in items-center justify-center rounded-inner border border-dashed border-line-soft text-sm text-muted">
      {children}
    </div>
  );
}
