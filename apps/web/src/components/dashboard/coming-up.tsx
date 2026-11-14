import { useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { cx } from '../../lib/cx';
import { afterStay, sentence } from '../../lib/calendar';
import { dayLabel } from '../../lib/dashboard-format';
import { byProperty, readUpcomingSort, saveUpcomingSort, type UpcomingSort } from '../../lib/upcoming';
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

const EVENT = { CHECK_IN: 'Check-in', CHECK_OUT: 'Check-out and clean' } as const;
// Green for arrivals, gold for check-outs and their cleans: they read apart at dot size.
const DOT = { CHECK_IN: 'bg-sage-mid', CHECK_OUT: 'bg-amber-mid' } as const;
const EVENT_TEXT = { CHECK_IN: 'text-sage-deep', CHECK_OUT: 'text-amber-deep' } as const;

/**
 * The line under an event. A check-in gives the stay that's starting ("Maya · 6 nights"); a check-out is one day, so
 * it says what it ends ("Maya · after a 6-night stay"), never "6 nights" as if the clean took that long.
 */
const stayLine = (e: UpcomingItem) =>
  (e.type === 'CHECK_OUT'
    ? [e.kind === 'GUEST' ? e.guestName : null, afterStay(e)]
    : [e.kind === 'OWNER_STAY' ? 'Owner stay' : e.guestName, `${e.nights} night${e.nights === 1 ? '' : 's'}`]
  )
    .filter(Boolean)
    .join(' · ');

/**
 * Next 14 days of check-ins and check-outs (at most 8), with a link to the full calendar. Across several properties
 * each row is headed by its property, and they can be listed by date or grouped by property (remembered in this
 * browser). For one property, each row is headed by what happens.
 */
export function ComingUp({
  items,
  total,
  showProperty,
}: {
  items: UpcomingItem[];
  total: number;
  showProperty: boolean;
}) {
  const [sort, setSort] = useState<UpcomingSort>(readUpcomingSort);
  const choose = (next: UpcomingSort) => {
    setSort(next);
    saveUpcomingSort(next);
  };
  const actions = (
    <div className="flex flex-wrap items-center gap-3">
      {showProperty && items.length > 0 && <SortToggle value={sort} onChange={choose} />}
      <Link to="/admin/calendar" className="rounded-control-sm text-sm font-semibold text-primary hover:underline">
        Full calendar
      </Link>
    </div>
  );
  return (
    <Card title="Coming up" description="Next 14 days" actions={actions}>
      {items.length === 0 ? (
        <EmptyState size="compact" illustration={<ComingUpIllustration />} title="Nothing in the next 14 days">
          Check-ins and check-outs will be listed here as they're booked.
        </EmptyState>
      ) : !showProperty ? (
        <ul className="flex flex-col divide-y divide-line-soft">
          {items.map((e) => (
            <Row key={`${e.bookingId}-${e.type}`} event={e} title={EVENT[e.type]} detail={sentence(stayLine(e))} />
          ))}
        </ul>
      ) : sort === 'date' ? (
        <ul aria-label="By date" className="flex flex-col divide-y divide-line-soft">
          {items.map((e) => (
            <Row
              key={`${e.bookingId}-${e.type}`}
              event={e}
              title={e.propertyName}
              detail={
                <>
                  <span className={cx('font-medium', EVENT_TEXT[e.type])}>{EVENT[e.type]}</span> · {stayLine(e)}
                </>
              }
            />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col gap-3.5">
          {byProperty(items).map((group, g) => (
            <section
              key={group.property}
              aria-labelledby={`cu-${g}`}
              className="border-t border-line-soft pt-3.5 first:border-t-0 first:pt-0"
            >
              <h3 id={`cu-${g}`} className="text-base font-semibold text-ink">
                {group.property}
              </h3>
              <ul className="mt-1 flex flex-col">
                {group.items.map((e) => (
                  <Row
                    key={`${e.bookingId}-${e.type}`}
                    event={e}
                    title={EVENT[e.type]}
                    detail={sentence(stayLine(e))}
                    compact
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
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

/** One check-in or check-out: its dot, a title and a line under it, and the day. */
function Row({
  event: e,
  title,
  detail,
  compact = false,
}: {
  event: UpcomingItem;
  title: string;
  detail: ReactNode;
  compact?: boolean;
}) {
  return (
    <li className={cx('flex items-start gap-3', compact ? 'py-2' : 'py-3 first:pt-0 last:pb-0')}>
      <span aria-hidden className={cx('mt-1.5 size-2.5 shrink-0 rounded-full', DOT[e.type])} />
      <div className="min-w-0 flex-1">
        <p className={cx('truncate text-ink', compact ? 'text-sm font-medium' : 'font-semibold')}>{title}</p>
        <p className="text-sm text-pretty text-muted">{detail}</p>
      </div>
      <span className="figure shrink-0 text-sm text-muted">{dayLabel(e.date)}</span>
    </li>
  );
}

/** By date or by property: two small buttons, the chosen one pressed. */
function SortToggle({ value, onChange }: { value: UpcomingSort; onChange: (sort: UpcomingSort) => void }) {
  return (
    <div role="group" aria-label="Sort" className="flex rounded-full bg-ground p-0.5 ring-1 ring-line-soft">
      {(
        [
          ['date', 'Date'],
          ['property', 'Property'],
        ] as const
      ).map(([key, label]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={cx(
            'rounded-full px-2.5 py-1 text-xs font-semibold transition-colors',
            value === key ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
