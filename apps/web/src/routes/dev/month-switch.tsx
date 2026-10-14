import { useState } from 'react';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ApiClient } from '@truhost/api-client';
import { OWN_PROPERTY_PLAN_ID } from '@truhost/shared';
import { OwnerExpenses, OwnerStays } from '../../components/owner/month-lists';
import { MonthOverview } from '../../components/owner/month-overview';
import { ApiContext } from '../../lib/api-context';

/**
 * Dev only: the owner page's month sections on a fake API where October has stays and expenses and every other month
 * is empty, for checking that stepping between a busy and an empty month doesn't shift or jump the layout.
 */
export const Route = createFileRoute('/dev/month-switch')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: Preview,
});

const booking = (
  id: string,
  checkInDate: string,
  checkOutDate: string,
  nights: number,
  channel: string,
  gross: number,
) => ({
  id,
  propertyId: 'p1',
  source: 'MANUAL',
  channel,
  kind: 'GUEST',
  status: 'CONFIRMED',
  checkInDate,
  checkOutDate,
  nights,
  ownerGrossCents: gross,
  complete: true,
  cancelledAt: null,
});

function fakeApi(): ApiClient {
  const busy = (month: string) => month === '2026-10';
  const summary = (month: string) => ({
    propertyId: 'p1',
    month,
    daysInMonth: 31,
    nightsBooked: busy(month) ? 8 : 0,
    ownerStayNights: 0,
    blockNights: 0,
    availableNights: 31,
    occupancyBps: busy(month) ? 2581 : 0,
    stays: busy(month) ? 3 : 0,
    grossCents: busy(month) ? 139_856 : 0,
    plan: { id: OWN_PROPERTY_PLAN_ID, name: 'Own property' },
    managementFeeBps: 0,
    managementFeeCents: 0,
    ownerExpensesCents: 0,
    netCents: busy(month) ? 139_856 : 0,
    avgNightlyEarningsCents: busy(month) ? 17_482 : null,
    incompleteBookings: 0,
    expensesMissingReceipt: 0,
  });
  const respond = (data: unknown) =>
    new Promise((resolve) => setTimeout(() => resolve({ data, response: new Response(null, { status: 200 }) }), 250));
  return {
    GET: (path: string, init: { params: { query: { month?: string; from?: string } } }) => {
      const month = init.params.query.month ?? init.params.query.from!.slice(0, 7);
      if (path.endsWith('/summary')) return respond(summary(month));
      if (path.endsWith('/bookings')) {
        return respond({
          items: busy(month)
            ? [
                booking('b1', '2026-10-03', '2026-10-06', 3, 'AIRBNB', 52_300),
                booking('b2', '2026-10-12', '2026-10-15', 3, 'VRBO', 49_100),
                booking('b3', '2026-10-22', '2026-10-24', 2, 'DIRECT', 38_456),
              ]
            : [],
        });
      }
      return respond({ items: [] });
    },
  } as unknown as ApiClient;
}

function Preview() {
  const [api] = useState(fakeApi);
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const [month, setMonth] = useState('2026-10');
  return (
    <ApiContext.Provider value={api}>
      <QueryClientProvider client={client}>
        <div className="@container/content min-h-dvh bg-ground">
          <main className="mx-auto flex w-full max-w-[1680px] flex-col gap-6 px-4 py-6 @2xl/content:px-8">
            <div className="h-56 rounded-card bg-line-soft" aria-hidden />
            <MonthOverview propertyId="p1" month={month} onMonthChange={setMonth} />
            <div className="grid grid-cols-1 gap-6 @[100rem]/content:grid-cols-2">
              <OwnerStays propertyId="p1" month={month} />
              <OwnerExpenses propertyId="p1" month={month} />
            </div>
          </main>
        </div>
      </QueryClientProvider>
    </ApiContext.Provider>
  );
}
