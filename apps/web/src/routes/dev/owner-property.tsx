import { useState } from 'react';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ApiClient } from '@truhost/api-client';
import { OWN_PROPERTY_PLAN_ID, type Property } from '@truhost/shared';
import { Pencil } from 'lucide-react';
import { PropertyDetailsPanel } from '../../components/owner/details-card';
import { ManagementCard } from '../../components/owner/management-card';
import { OwnerExpenses, OwnerStays } from '../../components/owner/month-lists';
import { MonthOverview } from '../../components/owner/month-overview';
import { PropertyHero } from '../../components/owner/property-hero';
import { PropertyRoomsCard } from '../../components/property-basics';
import { Button } from '../../components/ui/button';
import { ApiContext } from '../../lib/api-context';

/** Dev only: the owner's property page on a fake API (`?own=1`: an admin's own property, no fee). */
export const Route = createFileRoute('/dev/owner-property')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  validateSearch: (s: Record<string, unknown>) => ({ own: s.own === 1 || s.own === '1' ? 1 : undefined }),
  component: Preview,
});

const scene = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 700"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fb8de"/><stop offset="1" stop-color="#f3e7d3"/></linearGradient></defs><rect width="1600" height="700" fill="url(#s)"/><path d="M0 420 Q400 250 800 380 T1600 330 V700 H0Z" fill="#7da07a" opacity=".7"/><path d="M0 500 Q500 400 1000 500 T1600 480 V700 H0Z" fill="#5f8a5c"/><rect x="640" y="380" width="320" height="200" fill="#d9b48c"/><path d="M610 390 L800 250 L990 390Z" fill="#3a2a22"/><rect x="770" y="470" width="60" height="110" fill="#f3d9a4"/><rect x="680" y="420" width="60" height="50" fill="#f6efe2"/><rect x="860" y="420" width="60" height="50" fill="#f6efe2"/></svg>`,
)}`;

const PROPERTY: Property = {
  id: 'p1',
  name: 'Petersburg Retreat',
  description: null,
  bedrooms: 3,
  bathrooms: 2,
  halfBathrooms: 1,
  maxGuests: 6,
  airbnbUrl: 'https://www.airbnb.ca/rooms/0000000',
  vrboUrl: null,
  bookingComUrl: 'https://www.booking.com/hotel/ca/example.html',
  addressLine1: '12 Petersburg Rd',
  addressLine2: null,
  city: 'Kelowna',
  province: 'BC',
  postalCode: 'V1Y 1A1',
  country: 'CA',
  timeZone: 'America/Vancouver',
  checkInTime: '16:00',
  checkOutTime: '11:00',
  provincialRegistrationNumber: null,
  businessLicenceNumber: null,
  archivedAt: null,
  coverPhoto: { id: 'ph', url: scene, thumbUrl: scene, expiresAt: '2099-01-01T00:00:00.000Z' },
};

function fakeApi(own: boolean): ApiClient {
  const plan = own
    ? { id: OWN_PROPERTY_PLAN_ID, name: 'Own property', managementFeeBps: 0 }
    : { id: 'tru', name: 'TruPlan', managementFeeBps: 2200 };
  const fee = own ? 0 : 99_066;
  const booking = (
    id: string,
    checkInDate: string,
    checkOutDate: string,
    nights: number,
    channel: string,
    gross: number | null,
    kind = 'GUEST',
  ) => ({
    id,
    propertyId: 'p1',
    source: 'MANUAL',
    channel,
    kind,
    status: 'CONFIRMED',
    checkInDate,
    checkOutDate,
    nights,
    ownerGrossCents: gross,
    complete: gross !== null || kind !== 'GUEST',
    cancelledAt: null,
  });
  const data: Record<string, unknown> = {
    '/v1/properties': { items: [PROPERTY] },
    '/v1/properties/{id}/plan': {
      current: { id: 'pp', plan, effectiveFrom: '2026-07-01', effectiveTo: null },
      history: [],
    },
    '/v1/properties/{id}/summary': {
      propertyId: 'p1',
      month: '2026-10',
      daysInMonth: 31,
      nightsBooked: 19,
      ownerStayNights: 2,
      blockNights: 0,
      availableNights: 29,
      occupancyBps: 6552,
      stays: 5,
      grossCents: 450_300,
      plan: { id: plan.id, name: plan.name },
      managementFeeBps: plan.managementFeeBps,
      managementFeeCents: fee,
      ownerExpensesCents: own ? 0 : 25_394,
      netCents: 450_300 - fee - (own ? 0 : 25_394),
      avgNightlyEarningsCents: 23_700,
      incompleteBookings: 1,
      expensesMissingReceipt: 1,
    },
    '/v1/properties/{id}/bookings': {
      items: [
        booking('b1', '2026-10-01', '2026-10-04', 3, 'AIRBNB', 96_000),
        booking('b2', '2026-10-09', '2026-10-11', 2, 'DIRECT', null, 'OWNER_STAY'),
        booking('b3', '2026-10-13', '2026-10-19', 6, 'BOOKING_COM', 177_000),
        booking('b4', '2026-10-23', '2026-10-27', 4, 'VRBO', 136_000),
        booking('b5', '2026-10-28', '2026-10-31', 3, 'AIRBNB', null),
      ],
    },
    '/v1/properties/{id}/expenses': {
      items: [
        {
          id: 'e1',
          propertyId: 'p1',
          category: 'SUPPLIES',
          bearer: 'OWNER',
          incurredOn: '2026-10-05',
          vendor: 'Costco',
          description: 'Restock: towels, soap, coffee',
          amountCents: 8_975,
          gstCents: null,
          pstCents: null,
          receipts: [{ id: 'r1', fileId: 'f1' }],
          missingReceipt: false,
          voidedAt: null,
        },
        {
          id: 'e2',
          propertyId: 'p1',
          category: 'REPAIRS_MAINTENANCE',
          bearer: 'OWNER',
          incurredOn: '2026-10-20',
          vendor: 'Okanagan Plumbing',
          description: 'Fix kitchen tap',
          amountCents: 14_520,
          gstCents: null,
          pstCents: null,
          receipts: [],
          missingReceipt: true,
          voidedAt: null,
        },
        {
          id: 'e3',
          propertyId: 'p1',
          category: 'SUBSCRIPTIONS',
          bearer: 'OWNER',
          incurredOn: '2026-10-15',
          vendor: 'Netflix',
          description: 'Netflix Standard',
          amountCents: 1_899,
          gstCents: null,
          pstCents: null,
          receipts: [{ id: 'r2', fileId: 'f2' }],
          missingReceipt: false,
          voidedAt: null,
        },
      ],
    },
    '/v1/properties/{id}/rooms': {
      items: [
        'Entry',
        'Living room',
        'Kitchen',
        'Bedroom · Primary',
        'Bedroom 2',
        'Bedroom 3',
        'Bathroom 1',
        'Bathroom 2',
        'Patio/Deck',
      ].map((displayName, i) => ({
        id: `r${i}`,
        propertyId: 'p1',
        type: 'OTHER',
        label: displayName,
        number: 1,
        displayName,
        position: i,
        archivedAt: null,
      })),
    },
  };
  return {
    GET: async (path: string) => ({ data: data[path] ?? { items: [] }, response: new Response(null, { status: 200 }) }),
    POST: async () => ({ data: data['/v1/properties/{id}/plan'], response: new Response(null, { status: 200 }) }),
  } as unknown as ApiClient;
}

function Preview() {
  const own = Boolean(Route.useSearch().own);
  const [api] = useState(() => fakeApi(own));
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } }),
  );
  const [month, setMonth] = useState('2026-10');
  return (
    <ApiContext.Provider value={api}>
      <QueryClientProvider client={client}>
        <div className="@container/content min-h-dvh bg-ground px-4 py-6 @2xl/content:px-8">
          <div className="mx-auto flex max-w-[1680px] flex-col gap-6">
            <PropertyHero
              property={PROPERTY}
              index={0}
              role="OWNER"
              actions={
                <Button variant="secondary" size="sm" className="bg-white/90 backdrop-blur">
                  <Pencil aria-hidden className="size-4" /> Edit details
                </Button>
              }
            />
            <div className="grid grid-cols-1 items-start gap-6 @[68.75rem]/content:grid-cols-[minmax(0,1fr)_360px]">
              <div className="flex min-w-0 flex-col gap-6">
                <MonthOverview propertyId="p1" month={month} onMonthChange={setMonth} />
                <div className="grid grid-cols-1 gap-6 @[100rem]/content:grid-cols-2">
                  <OwnerStays propertyId="p1" month={month} />
                  <OwnerExpenses propertyId="p1" month={month} />
                </div>
              </div>
              <aside className="grid min-w-0 grid-cols-1 content-start gap-6 @2xl/content:grid-cols-2 @[68.75rem]/content:grid-cols-1">
                <ManagementCard propertyId="p1" canMarkOwn={!own} />
                <PropertyDetailsPanel property={PROPERTY} />
                <PropertyRoomsCard propertyId="p1" />
              </aside>
            </div>
          </div>
        </div>
      </QueryClientProvider>
    </ApiContext.Provider>
  );
}
