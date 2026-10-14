import { createFileRoute, notFound } from '@tanstack/react-router';
import { MonthAgenda } from '../../components/calendar/month-agenda';
import { MonthSummary } from '../../components/calendar/month-summary';
import { CalendarLegend, MonthCalendar } from '../../components/dashboard/month-calendar';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import type { Dashboard } from '../../lib/api-types';
import { monthAgenda, type CalendarStay } from '../../lib/calendar';

/**
 * Dev only: the Calendar page's layout on fixture stays (no sign-in, no API), for review screenshots. `?all=1` shows
 * two properties. The real page is /admin/calendar.
 */
export const Route = createFileRoute('/dev/calendar')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  validateSearch: (search: Record<string, unknown>) => ({
    all: Boolean(search.all) && !['false', '0'].includes(String(search.all)),
  }),
  component: CalendarPreview,
});

const MONTH = '2026-10';
const TODAY = '2026-10-14';
const NAMES = new Map([
  ['p1', 'Petersburg Retreat'],
  ['p2', 'Cedar Cabin'],
]);

const stay = (
  id: string,
  propertyId: string,
  checkInDate: string,
  checkOutDate: string,
  nights: number,
  guestName: string | null,
  kind: CalendarStay['kind'] = 'GUEST',
  channel: CalendarStay['channel'] = 'AIRBNB',
): CalendarStay => ({ id, propertyId, kind, channel, checkInDate, checkOutDate, nights, guestName });

const STAYS: CalendarStay[] = [
  stay('a', 'p1', '2026-10-02', '2026-10-05', 3, 'Maya'),
  stay('b', 'p1', '2026-10-10', '2026-10-18', 8, 'Andrew'),
  stay('c', 'p1', '2026-10-19', '2026-10-21', 2, 'Leila', 'GUEST', 'VRBO'),
  stay('d', 'p1', '2026-10-22', '2026-10-24', 2, 'Tessa', 'GUEST', 'BOOKING_COM'),
  stay('e', 'p1', '2026-10-26', '2026-10-29', 3, null, 'OWNER_STAY'),
  stay('f', 'p2', '2026-10-06', '2026-10-09', 3, 'Jordan', 'GUEST', 'DIRECT'),
  stay('g', 'p2', '2026-10-15', '2026-10-20', 5, 'Priya'),
  stay('h', 'p2', '2026-10-30', '2026-11-02', 3, 'Sam', 'GUEST', 'VRBO'),
];

const kpis = (stays: CalendarStay[], properties: number): Dashboard['kpis'] => {
  const nightsByDay = Array.from({ length: 31 }, (_, i) => {
    const day = `${MONTH}-${String(i + 1).padStart(2, '0')}`;
    const covering = stays.filter((s) => s.checkInDate <= day && day < s.checkOutDate);
    const unavailable = covering.filter((s) => s.kind !== 'GUEST').length;
    return { booked: covering.filter((s) => s.kind === 'GUEST').length, available: properties - unavailable };
  });
  const guest = stays.filter((s) => s.kind === 'GUEST');
  return {
    grossCents: 412_340,
    stays: guest.length,
    incompleteBookings: 1,
    managementFeeCents: 90_715,
    feeRatesBps: [2200],
    nightsBooked: nightsByDay.reduce((n, d) => n + d.booked, 0),
    availableNights: nightsByDay.reduce((n, d) => n + d.available, 0),
    occupancyBps: 5200,
    avgNightlyEarningsCents: 24_255,
    completeNights: 17,
    grossByStayCents: guest.map((_, i) => 40_000 + i * 9_000),
    feeShareBps: 2200,
    nightsByDay,
    nightlyLowCents: 17_000,
    nightlyHighCents: 26_400,
  };
};

function CalendarPreview() {
  const { all } = Route.useSearch();
  const stays = all ? STAYS : STAYS.filter((s) => s.propertyId === 'p1');
  const agenda = monthAgenda(MONTH, stays);
  return (
    <div className="@container/content min-h-dvh bg-ground px-4 py-6 @2xl/content:px-8 @2xl/content:py-8">
      <div className="mx-auto max-w-[1680px]">
        <PageHeader
          title="Calendar"
          description={all ? 'All properties' : 'Petersburg Retreat'}
          actions={<Button>Add booking</Button>}
        />
        <div className="flex flex-col gap-6">
          <MonthSummary month={MONTH} kpis={kpis(stays, all ? 2 : 1)} agenda={agenda} today={TODAY} />
          <div className="grid grid-cols-1 items-start gap-6 @[68.75rem]/content:grid-cols-[minmax(0,1fr)_340px]">
            <Card title="October 2026" actions={<CalendarLegend month={MONTH} stays={stays} />}>
              <MonthCalendar
                month={MONTH}
                stays={stays}
                propertyNames={NAMES}
                today={TODAY}
                showProperty={all}
                onSelect={() => undefined}
                roomy
              />
            </Card>
            <MonthAgenda
              month={MONTH}
              agenda={agenda}
              today={TODAY}
              propertyNames={NAMES}
              showProperty={all}
              onSelect={() => undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
