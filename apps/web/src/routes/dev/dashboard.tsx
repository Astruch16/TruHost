import { useState } from 'react';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { AppShell } from '../../components/shell/app-shell';
import { DashboardView } from '../../components/dashboard/dashboard-view';
import type { Dashboard } from '../../lib/api-types';
import type { CalendarStay } from '../../lib/calendar';
import { navItems } from '../../lib/nav';

/**
 * Dev-only preview of the dashboard layout with FIXTURE data (not served in production builds). The real
 * dashboard at /admin only ever shows figures from the API. `?state=empty` previews the no-properties state;
 * `?state=new` a single property with nothing entered yet.
 */
export const Route = createFileRoute('/dev/dashboard')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  validateSearch: (s: Record<string, unknown>) => ({
    state: s.state === 'empty' || s.state === 'new' ? s.state : 'data',
  }),
  component: Preview,
});

const FIXTURE_PROPERTIES = [
  { id: 'p1', name: 'Fixture Suite', city: 'Chilliwack', province: 'BC' },
  { id: 'p2', name: 'Fixture Cabin', city: 'Cultus Lake', province: 'BC' },
];

const stay = (
  id: string,
  propertyId: string,
  checkInDate: string,
  checkOutDate: string,
  nights: number,
  kind: CalendarStay['kind'] = 'GUEST',
): CalendarStay => ({
  id,
  propertyId,
  kind,
  checkInDate,
  checkOutDate,
  nights,
});

const FIXTURE_STAYS: CalendarStay[] = [
  stay('s1', 'p1', '2026-10-01', '2026-10-04', 3),
  stay('s2', 'p1', '2026-10-08', '2026-10-12', 4),
  stay('s3', 'p2', '2026-10-09', '2026-10-11', 2),
  stay('s4', 'p1', '2026-10-15', '2026-10-18', 3),
  stay('s5', 'p2', '2026-10-17', '2026-10-24', 7, 'OWNER_STAY'),
  stay('s6', 'p1', '2026-10-22', '2026-10-27', 5),
  stay('s7', 'p1', '2026-10-30', '2026-11-01', 2),
];

const FIXTURE: Dashboard = {
  month: '2026-10',
  today: '2026-10-06',
  period: 'MONTH_TO_DATE',
  scope: { propertyId: null, propertyCount: 2 },
  kpis: {
    grossCents: 412_340,
    stays: 6,
    incompleteBookings: 1,
    managementFeeCents: 90_715,
    feeRatesBps: [2200],
    nightsBooked: 19,
    availableNights: 55,
    occupancyBps: 3455,
    avgNightlyEarningsCents: 24_255,
    completeNights: 17,
  },
  comparison: null,
  noComparisonReason: 'MONTH_NOT_ENDED',
  breakdown: {
    grossCents: 412_340,
    managementFeeCents: 90_715,
    ownerExpensesCents: 6_418,
    netToOwnersCents: 315_207,
    cleaningFeesCents: 51_000,
  },
  properties: [
    {
      ...FIXTURE_PROPERTIES[0]!,
      archived: false,
      hasPlan: true,
      occupancyBps: 5484,
      nightsBooked: 17,
      grossCents: 412_340,
    },
    { ...FIXTURE_PROPERTIES[1]!, archived: false, hasPlan: false, occupancyBps: 833, nightsBooked: 2, grossCents: 0 },
  ],
  attention: {
    total: 3,
    items: [
      {
        kind: 'PAYOUT_MISSING',
        id: 'b1',
        propertyId: 'p2',
        propertyName: 'Fixture Cabin',
        title: 'Payout not entered',
        detail: 'Stay from Oct 9 (2 nights) isn’t counted until its payout and cleaning fee are entered.',
        date: '2026-10-09',
      },
      {
        kind: 'RECEIPT_MISSING',
        id: 'e1',
        propertyId: 'p1',
        propertyName: 'Fixture Suite',
        title: 'Receipt missing',
        detail: 'Coffee pods, $24.99. Owner-borne expenses need a receipt.',
        date: '2026-10-03',
      },
      {
        kind: 'NO_PLAN',
        id: 'p2',
        propertyId: 'p2',
        propertyName: 'Fixture Cabin',
        title: 'No plan in force',
        detail: 'Fixture Cabin has no management plan for October 2026, so no TruPlan fee is charged.',
        date: null,
      },
    ],
  },
  upcoming: {
    total: 9,
    items: [
      {
        type: 'CHECK_IN',
        date: '2026-10-08',
        bookingId: 's2',
        propertyId: 'p1',
        propertyName: 'Fixture Suite',
        kind: 'GUEST',
        nights: 4,
        guestName: 'Fixture Guest',
      },
      {
        type: 'CHECK_IN',
        date: '2026-10-09',
        bookingId: 's3',
        propertyId: 'p2',
        propertyName: 'Fixture Cabin',
        kind: 'GUEST',
        nights: 2,
        guestName: null,
      },
      {
        type: 'CHECK_OUT',
        date: '2026-10-11',
        bookingId: 's3',
        propertyId: 'p2',
        propertyName: 'Fixture Cabin',
        kind: 'GUEST',
        nights: 2,
        guestName: null,
      },
      {
        type: 'CHECK_OUT',
        date: '2026-10-12',
        bookingId: 's2',
        propertyId: 'p1',
        propertyName: 'Fixture Suite',
        kind: 'GUEST',
        nights: 4,
        guestName: 'Fixture Guest',
      },
      {
        type: 'CHECK_IN',
        date: '2026-10-15',
        bookingId: 's4',
        propertyId: 'p1',
        propertyName: 'Fixture Suite',
        kind: 'GUEST',
        nights: 3,
        guestName: null,
      },
      {
        type: 'CHECK_IN',
        date: '2026-10-17',
        bookingId: 's5',
        propertyId: 'p2',
        propertyName: 'Fixture Cabin',
        kind: 'OWNER_STAY',
        nights: 7,
        guestName: null,
      },
      {
        type: 'CHECK_OUT',
        date: '2026-10-18',
        bookingId: 's4',
        propertyId: 'p1',
        propertyName: 'Fixture Suite',
        kind: 'GUEST',
        nights: 3,
        guestName: null,
      },
      {
        type: 'CHECK_IN',
        date: '2026-10-19',
        bookingId: 's9',
        propertyId: 'p1',
        propertyName: 'Fixture Suite',
        kind: 'GUEST',
        nights: 2,
        guestName: null,
      },
    ],
  },
};

const EMPTY_SINGLE: Dashboard = {
  ...FIXTURE,
  scope: { propertyId: null, propertyCount: 1 },
  kpis: {
    grossCents: 0,
    stays: 0,
    incompleteBookings: 0,
    managementFeeCents: 0,
    feeRatesBps: [2200],
    nightsBooked: 0,
    availableNights: 31,
    occupancyBps: 0,
    avgNightlyEarningsCents: null,
    completeNights: 0,
  },
  breakdown: { grossCents: 0, managementFeeCents: 0, ownerExpensesCents: 0, netToOwnersCents: 0, cleaningFeesCents: 0 },
  properties: [
    { ...FIXTURE_PROPERTIES[0]!, archived: false, hasPlan: true, occupancyBps: 0, nightsBooked: 0, grossCents: 0 },
  ],
  attention: { total: 0, items: [] },
  upcoming: { total: 0, items: [] },
};

function Preview() {
  const { state } = Route.useSearch();
  const [month, setMonth] = useState('2026-10');
  const props = state === 'empty' ? [] : state === 'new' ? [FIXTURE_PROPERTIES[0]!] : FIXTURE_PROPERTIES;
  return (
    <AppShell
      nav={navItems({ staffRole: 'ADMIN', memberships: [] })}
      user={{ name: 'Preview Admin', initials: 'PA', role: 'Admin', email: 'admin@example.test' }}
      properties={props}
      selectedPropertyId={null}
      onSelectProperty={() => undefined}
      allowAllProperties
      onSignOut={() => undefined}
      onManageSignIn={() => undefined}
    >
      <p className="mb-4 rounded-control bg-lavender-tint px-3 py-2 text-sm text-lavender-deep">
        Dev preview with fixture data. The real dashboard is at /admin.
      </p>
      <DashboardView
        firstName="Preview"
        now={new Date('2026-10-06T09:30:00')}
        month={month}
        onMonthChange={setMonth}
        scope={{ propertyId: null, name: null }}
        properties={props}
        dashboard={state === 'empty' ? undefined : state === 'new' ? EMPTY_SINGLE : FIXTURE}
        dashboardError={null}
        stays={state === 'data' ? FIXTURE_STAYS : []}
        staysError={null}
        onAction={() => undefined}
        onAddProperty={() => undefined}
      />
    </AppShell>
  );
}
