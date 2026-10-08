import { Link } from '@tanstack/react-router';
import { cx } from '../../lib/cx';
import { dayLabel } from '../../lib/dashboard-format';
import { ComingUpIllustration } from '../illustrations/coming-up';
import { Card } from '../ui/card';
import { EmptyState } from '../ui/empty-state';

export interface UpcomingItem {
  type: 'CHECK_IN' | 'CHECK_OUT';
  date: string;
  bookingId: string;
  propertyName: string;
  kind: 'GUEST' | 'OWNER_STAY' | 'BLOCK';
  nights: number;
  guestName: string | null;
}

/** Next 14 days of check-ins and check-outs (at most 8), with a link to the full calendar. */
export function ComingUp({
  items,
  total,
  showProperty,
}: {
  items: UpcomingItem[];
  total: number;
  showProperty: boolean;
}) {
  const link = (
    <Link to="/admin/calendar" className="rounded-control-sm text-sm font-semibold text-primary hover:underline">
      Full calendar
    </Link>
  );
  return (
    <Card title="Coming up" description="Next 14 days" actions={link}>
      {items.length === 0 ? (
        <EmptyState size="compact" illustration={<ComingUpIllustration />} title="Nothing in the next 14 days">
          Check-ins and check-outs will be listed here as they're booked.
        </EmptyState>
      ) : (
        <ul className="flex flex-col divide-y divide-line-soft">
          {items.map((e) => (
            <li key={`${e.bookingId}-${e.type}`} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <span
                aria-hidden
                className={cx(
                  'mt-1.5 size-2.5 shrink-0 rounded-full',
                  e.type === 'CHECK_IN' ? 'bg-blue-deep' : 'bg-lavender-deep',
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{e.type === 'CHECK_IN' ? 'Check-in' : 'Check-out and clean'}</p>
                <p className="truncate text-sm text-muted">
                  {[
                    showProperty ? e.propertyName : null,
                    e.kind === 'OWNER_STAY' ? 'Owner stay' : e.guestName,
                    `${e.nights} night${e.nights === 1 ? '' : 's'}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <span className="figure shrink-0 text-sm text-muted">{dayLabel(e.date)}</span>
            </li>
          ))}
        </ul>
      )}
      {total > items.length && (
        <p className="mt-3 text-sm text-muted">
          +{total - items.length} more in the{' '}
          <Link to="/admin/calendar" className="font-semibold text-primary hover:underline">
            full calendar
          </Link>
          .
        </p>
      )}
    </Card>
  );
}
