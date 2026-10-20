import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { OwnerCalendar } from '@truhost/shared';
import { useApi } from '../../lib/api-context';
import { stayStyle, type CalendarStay } from '../../lib/calendar';
import { cx } from '../../lib/cx';
import { channelLabel } from '../../lib/format';
import { formatCents } from '../../lib/money';
import { monthLabel, shortDate } from '../../lib/months';
import { monthOnly, monthShort } from '../../lib/owner';
import { queries } from '../../lib/queries';
import { updatingStyles } from '../../lib/styles';
import { CalendarLegend, MonthCalendar } from '../dashboard/month-calendar';
import { BookingsIllustration } from '../illustrations/bookings';
import { LoadError } from '../ui/alert';
import { Card } from '../ui/card';
import { Dialog } from '../ui/dialog';
import { EmptyState } from '../ui/empty-state';
import { MonthStepper } from '../ui/month-stepper';
import { PageHeader } from '../ui/page-header';
import { Pill } from '../ui/pill';
import { Skeleton } from '../ui/skeleton';

type Item = OwnerCalendar['items'][number];

const kindLabel = (i: Item) =>
  i.kind === 'OWNER_STAY'
    ? 'Owner stay'
    : i.kind === 'BLOCK'
      ? 'Blocked'
      : `${channelLabel(i.channel ?? 'OTHER')} guest`;

/**
 * The owner's month: guest stays (by channel), their own stays and blocked dates, read-only. Tapping a stay shows
 * its dates, nights and the owner's share (payout less the cleaning fee, and this month's part of it).
 */
export function OwnerCalendarPage({
  month,
  onMonthChange,
  propertyId,
  today,
}: {
  month: string;
  onMonthChange: (month: string) => void;
  propertyId: string | null;
  today: string;
}) {
  const api = useApi();
  const cal = useQuery(queries.ownerCalendar(api, month, propertyId));
  const [open, setOpen] = useState<Item | null>(null);
  const items = cal.data?.items ?? [];
  const names = new Map(items.map((i) => [i.property.id, i.property.name]));
  const many = names.size > 1;
  const stays: CalendarStay[] = items.map((i) => ({
    id: i.bookingId,
    propertyId: i.property.id,
    kind: i.kind,
    channel: i.channel ?? 'OTHER',
    checkInDate: i.checkInDate,
    checkOutDate: i.checkOutDate,
    nights: i.nights,
  }));

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Guest stays, your own stays and blocked dates. Tap a stay for its details."
      />
      <Card tour="owner-calendar">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <MonthStepper month={month} onChange={onMonthChange} />
          {stays.length > 0 && <CalendarLegend month={month} stays={stays} showCleans={false} />}
        </div>
        {cal.error ? (
          <LoadError what="the calendar" onRetry={() => void cal.refetch()} retrying={cal.isFetching} />
        ) : !cal.data ? (
          <Skeleton className="h-96 rounded-inner" />
        ) : (
          <div className={updatingStyles(cal.isPlaceholderData)} aria-busy={cal.isPlaceholderData || undefined}>
            <MonthCalendar
              month={month}
              stays={stays}
              propertyNames={names}
              today={today}
              showProperty={many}
              onSelect={(id) => setOpen(items.find((i) => i.bookingId === id) ?? null)}
              roomy
              showCleans={false}
            />
          </div>
        )}
      </Card>
      {cal.data && (
        <Card
          tour="owner-glance"
          className={cx('mt-6', updatingStyles(cal.isPlaceholderData))}
          title={`${monthLabel(month)} at a glance`}
          description={
            items.length > 0
              ? `${items.length} ${items.length === 1 ? 'stay' : 'stays'} · tap one for its details`
              : undefined
          }
        >
          {items.length === 0 ? (
            <EmptyState size="compact" illustration={<BookingsIllustration />} title="Nothing booked this month">
              Stays show up here as soon as they’re booked.
            </EmptyState>
          ) : (
            <ul className="grid grid-cols-1 gap-2.5 @4xl/content:grid-cols-2">
              {items.map((i) => (
                <li key={i.bookingId} className="min-w-0">
                  <GlanceTile item={i} month={month} showProperty={many} onOpen={() => setOpen(i)} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      {open && (
        <Dialog
          open
          onOpenChange={(o) => !o && setOpen(null)}
          title={kindLabel(open)}
          description={many ? open.property.name : undefined}
          size="sm"
        >
          <dl className="flex flex-col gap-2.5 text-sm">
            <Row label="Check-in" value={shortDate(open.checkInDate)} />
            <Row label="Check-out" value={shortDate(open.checkOutDate)} />
            <Row
              label="Nights"
              value={
                open.nightsInMonth === open.nights
                  ? `${open.nights}`
                  : `${open.nights} (${open.nightsInMonth} in ${monthOnly(month)})`
              }
            />
            {open.kind === 'GUEST' &&
              (open.ownerGrossCents === null ? (
                <p className="rounded-inner bg-amber-tint px-3 py-2 text-amber-deep">
                  The payout hasn’t arrived yet, so your share isn’t known yet.
                </p>
              ) : (
                <>
                  <Row label="Your share of the stay" value={formatCents(open.ownerGrossCents)} strong />
                  {open.nightsInMonth !== open.nights && open.monthShareCents !== null && (
                    <Row label={`In ${monthOnly(month)}`} value={formatCents(open.monthShareCents)} />
                  )}
                  <p className="text-xs text-muted">
                    The payout less the guest cleaning fee, before the TruPlan fee. It’s split per night when a stay
                    crosses months.
                  </p>
                </>
              ))}
            {open.kind === 'OWNER_STAY' && (
              <p className="text-xs text-muted">
                The standard cleaning fee for the turnover after it is on that month’s statement.
              </p>
            )}
          </dl>
        </Dialog>
      )}
    </>
  );
}

/** One stay: a date tile in the stay's calendar colour, what it is and when, and the owner's share this month. */
function GlanceTile({
  item: i,
  month,
  showProperty,
  onOpen,
}: {
  item: Item;
  month: string;
  showProperty: boolean;
  onOpen: () => void;
}) {
  const style = stayStyle({ kind: i.kind, channel: i.channel ?? 'OTHER' });
  const [mon, day] = shortDate(i.checkInDate).split(' ');
  const split = i.nightsInMonth !== i.nights;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-full w-full items-center gap-3.5 rounded-inner border border-line bg-surface p-3 text-left transition-colors hover:border-ink/20 hover:bg-ground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-deep"
    >
      <span
        aria-hidden
        className={cx('flex w-13 shrink-0 flex-col items-center rounded-inner py-2 text-center', style.bar)}
      >
        <span className="text-[11px] font-semibold tracking-[0.06em] uppercase opacity-80">{mon}</span>
        <span className="figure text-xl leading-none font-bold">{day}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-ink">{kindLabel(i)}</span>
        <span className="mt-0.5 block text-sm text-ink/80">
          {shortDate(i.checkInDate)} → {shortDate(i.checkOutDate)}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted">
          {i.nights} night{i.nights === 1 ? '' : 's'}
          {split ? ` · ${i.nightsInMonth} in ${monthOnly(month)}` : ''}
          {showProperty ? ` · ${i.property.name}` : ''}
        </span>
      </span>
      <span className="shrink-0 text-right">
        {i.kind === 'GUEST' ? (
          i.monthShareCents !== null ? (
            <>
              <span className="figure block text-lg leading-tight font-semibold text-ink">
                {formatCents(i.monthShareCents)}
              </span>
              <span className="block text-xs text-muted">
                {split ? `Your share in ${monthShort(month)}` : 'Your share'}
              </span>
            </>
          ) : (
            <Pill tone="amber">Payout pending</Pill>
          )
        ) : (
          <Pill tone={i.kind === 'OWNER_STAY' ? 'lavender' : 'neutral'}>
            {i.kind === 'OWNER_STAY' ? 'Your stay' : 'No guests'}
          </Pill>
        )}
      </span>
    </button>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className={strong ? 'figure font-semibold text-ink' : 'figure text-ink'}>{value}</dd>
    </div>
  );
}
