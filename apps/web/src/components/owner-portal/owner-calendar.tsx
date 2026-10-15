import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { OwnerCalendar } from '@truhost/shared';
import { useApi } from '../../lib/api-context';
import type { CalendarStay } from '../../lib/calendar';
import { channelLabel } from '../../lib/format';
import { formatCents } from '../../lib/money';
import { monthLabel, shortDate } from '../../lib/months';
import { monthOnly } from '../../lib/owner';
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
      <Card>
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
            <h2 className="mt-6 mb-2 text-base font-semibold text-ink">{monthLabel(month)} at a glance</h2>
            {items.length === 0 ? (
              <EmptyState size="compact" illustration={<BookingsIllustration />} title="Nothing booked this month">
                Stays show up here as soon as they’re booked.
              </EmptyState>
            ) : (
              <ul className="flex flex-col">
                {items.map((i) => (
                  <li key={i.bookingId} className="border-b border-line last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setOpen(i)}
                      className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-ground focus-visible:outline-2 focus-visible:outline-blue-deep"
                    >
                      <span className="min-w-0">
                        <span className="block font-medium text-ink">
                          {shortDate(i.checkInDate)} – {shortDate(i.checkOutDate)}
                        </span>
                        <span className="block text-xs text-muted">
                          {kindLabel(i)} · {i.nights} night{i.nights === 1 ? '' : 's'}
                          {many ? ` · ${i.property.name}` : ''}
                        </span>
                      </span>
                      {i.kind === 'GUEST' ? (
                        i.monthShareCents !== null ? (
                          <span className="figure shrink-0 font-semibold text-ink">
                            {formatCents(i.monthShareCents)}
                          </span>
                        ) : (
                          <Pill tone="amber">Payout pending</Pill>
                        )
                      ) : (
                        <Pill tone={i.kind === 'OWNER_STAY' ? 'lavender' : 'neutral'}>{kindLabel(i)}</Pill>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>
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

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className={strong ? 'figure font-semibold text-ink' : 'figure text-ink'}>{value}</dd>
    </div>
  );
}
