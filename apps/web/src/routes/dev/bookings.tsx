import { createFileRoute, notFound } from '@tanstack/react-router';
import { BookingsList } from '../../components/bookings/bookings-list';
import { BookingsSummary } from '../../components/bookings/bookings-summary';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import type { Booking, Dashboard } from '../../lib/api-types';

/**
 * Dev only: the Bookings page's layout on fixture bookings (no sign-in, no API), for review screenshots. `?all=1` shows
 * two properties. The real page is /admin/bookings.
 */
export const Route = createFileRoute('/dev/bookings')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  validateSearch: (search: Record<string, unknown>) => ({
    all: Boolean(search.all) && !['false', '0'].includes(String(search.all)),
  }),
  component: BookingsPreview,
});

const TODAY = '2026-10-14';
const NAMES: Record<string, string> = { p1: 'Petersburg Retreat', p2: 'Cedar Cabin' };

const booking = (
  id: string,
  propertyId: string,
  checkInDate: string,
  checkOutDate: string,
  nights: number,
  guestName: string | null,
  money: { payout: number | null; fee: number | null } | null,
  extra: Partial<Booking> = {},
): Booking => ({
  id,
  propertyId,
  source: 'MANUAL',
  channel: 'AIRBNB',
  kind: 'GUEST',
  status: 'CONFIRMED',
  checkInDate,
  checkOutDate,
  nights,
  guestName,
  payoutCents: money?.payout ?? null,
  guestCleaningFeeCents: money?.fee ?? null,
  ownerGrossCents: money?.payout != null && money.fee != null ? money.payout - money.fee : null,
  complete: money?.payout != null && money.fee != null,
  cancelledAt: null,
  ...extra,
});

const BOOKINGS: Booking[] = [
  booking('a', 'p1', '2026-10-02', '2026-10-05', 3, 'Maya', { payout: 51_200, fee: 3_500 }),
  booking('f', 'p2', '2026-10-06', '2026-10-09', 3, 'Jordan', { payout: 61_000, fee: 4_500 }, { channel: 'DIRECT' }),
  booking('b', 'p1', '2026-10-10', '2026-10-18', 8, 'Andrew', { payout: 97_888, fee: 3_500 }),
  booking('g', 'p2', '2026-10-15', '2026-10-20', 5, 'Priya', null),
  booking('c', 'p1', '2026-10-19', '2026-10-21', 2, 'Leila', { payout: 22_939, fee: 3_500 }, { channel: 'VRBO' }),
  booking('d', 'p1', '2026-10-22', '2026-10-24', 2, 'Tessa', null, { channel: 'BOOKING_COM' }),
  booking('x', 'p2', '2026-10-24', '2026-10-26', 2, 'Chris', null, {
    status: 'CANCELLED',
    cancelledAt: '2026-10-12T18:00:00.000Z',
  }),
  booking('e', 'p1', '2026-10-26', '2026-10-29', 3, null, null, { kind: 'OWNER_STAY', complete: true }),
];

const SUMMARY = {
  kpis: {
    grossCents: 228_027,
    stays: 6,
    incompleteBookings: 2,
    managementFeeCents: 50_166,
    feeRatesBps: [2200],
    nightsBooked: 23,
    availableNights: 59,
    occupancyBps: 3898,
    avgNightlyEarningsCents: 18_419,
    completeNights: 16,
    grossByStayCents: [47_700, 56_500, 94_388, 19_439],
    feeShareBps: 2200,
    nightsByDay: [],
    nightlyLowCents: 9_720,
    nightlyHighCents: 18_833,
  },
  breakdown: {
    grossCents: 228_027,
    managementFeeCents: 50_166,
    ownerExpensesCents: 0,
    netToOwnersCents: 177_861,
    cleaningFeesCents: 15_000,
  },
} as unknown as Dashboard;

function BookingsPreview() {
  const { all } = Route.useSearch();
  const items = all ? BOOKINGS : BOOKINGS.filter((b) => b.propertyId === 'p1');
  return (
    <div className="@container/content min-h-dvh bg-ground px-4 py-6 @2xl/content:px-8 @2xl/content:py-8">
      <div className="mx-auto max-w-[1680px]">
        <PageHeader
          title="Bookings"
          description="Stays overlapping the month. Enter each payout and cleaning fee as they arrive."
          actions={<Button>Add booking</Button>}
        />
        <div className="flex flex-col gap-6">
          <BookingsSummary data={SUMMARY} />
          <Card>
            <BookingsList
              month="2026-10"
              items={items}
              loading={false}
              error={null}
              updating={false}
              today={TODAY}
              propertyName={all ? (id) => NAMES[id] ?? '' : undefined}
              onEdit={() => undefined}
              onCancel={() => undefined}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
