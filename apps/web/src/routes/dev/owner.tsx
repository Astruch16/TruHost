import { useState } from 'react';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ApiClient } from '@truhost/api-client';
import type { OwnerHome } from '@truhost/shared';
import { OwnerCalendarPage } from '../../components/owner-portal/owner-calendar';
import { OwnerHomePage } from '../../components/owner-portal/owner-home';
import { OwnerCarePage, OwnerStatementsPage } from '../../components/owner-portal/owner-statements';
import { OwnerDamagePage } from '../../components/owner-portal/owner-damage';
import { DEV_DAMAGE } from '../../lib/dev-damage-fixtures';
import { AppShell } from '../../components/shell/app-shell';
import { ApiContext } from '../../lib/api-context';
import { navItems } from '../../lib/nav';

const VIEWS = ['home', 'statements', 'calendar', 'damage', 'care'] as const;
type View = (typeof VIEWS)[number];

/**
 * Dev only: the owner portal for a brand-new owner (nothing released, nothing booked) on a fake API, in the real
 * shell, for review screenshots of the empty states (and, for `damage`, reports as owners see them).
 * `?view=home|statements|calendar|damage|care`. The real pages are
 * /owner/....
 */
export const Route = createFileRoute('/dev/owner')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  validateSearch: (search: Record<string, unknown>): { view: View } => ({
    view: VIEWS.includes(search.view as View) ? (search.view as View) : 'home',
  }),
  component: OwnerPreview,
});

const NEW_OWNER: OwnerHome = {
  today: '2026-10-15',
  month: '2026-10',
  properties: 1,
  latest: null,
  thisMonth: {
    month: '2026-10',
    estimatedNetCents: 0,
    grossCents: 0,
    nightsBooked: 0,
    nightsStayed: 0,
    nightsUpcoming: 0,
    daysInMonth: 31,
    stays: 0,
    pendingPayouts: 0,
    statementExpected: '2026-11',
  },
  yearToDate: {
    year: 2026,
    months: 0,
    netCents: 0,
    nightsBooked: 0,
    occupancyBps: null,
    avgNightlyEarningsCents: null,
  },
  netByMonth: Array.from({ length: 10 }, (_, i) => ({
    month: `2026-${String(i + 1).padStart(2, '0')}`,
    netCents: i === 9 ? 0 : null,
    state: i === 9 ? ('IN_PROGRESS' as const) : ('PENDING' as const),
  })),
  comingUp: [],
  goodToKnow: [],
};

function fakeApi(): ApiClient {
  const respond = (data: unknown) => Promise.resolve({ data, error: undefined, response: new Response(null) });
  return {
    GET: (path: string) => {
      if (path === '/v1/owner/home') return respond(NEW_OWNER);
      if (path === '/v1/owner/calendar') return respond({ month: '2026-10', items: [] });
      if (path === '/v1/owner/month')
        return respond({
          month: '2026-10',
          basis: 'ESTIMATE',
          statementIds: [],
          releasedOn: null,
          netCents: 0,
          grossCents: 0,
          managementFeeCents: 0,
          expensesCents: 0,
          adjustmentsCents: 0,
          nightsBooked: 0,
          estimatedProperties: 1,
          change: { month: '2026-09', netCents: 0, changeCents: 0 },
          timing: 'CURRENT',
        });
      // As the owner API shapes them: sent reports only, no guest names, nothing to act on.
      const owned = DEV_DAMAGE.filter((r) => r.status !== 'DRAFT').map((r) => ({
        ...r,
        booking: r.booking && { ...r.booking, guestName: null },
        can: { edit: false, addPhotos: false, submit: false, manage: false },
      }));
      if (path === '/v1/owner/damage') return respond({ items: owned });
      if (path === '/v1/owner/damage/{id}') return respond(owned[0]);
      if (path === '/v1/config') return respond({ taxFieldsEnabled: false, contactEmail: 'hello@truhost.example' });
      return respond({ items: [] });
    },
  } as unknown as ApiClient;
}

function OwnerPreview() {
  const { view } = Route.useSearch();
  const [api] = useState(fakeApi);
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const [month, setMonth] = useState('2026-10');
  const property = { id: 'p1', name: 'Harbour Suite', city: 'Vancouver', province: 'BC', photoUrl: null };
  return (
    <ApiContext.Provider value={api}>
      <QueryClientProvider client={client}>
        <AppShell
          nav={navItems({ staffRole: null, memberships: [{ role: 'OWNER' }] })}
          user={{ name: 'Nadia Brooks', initials: 'NB', role: 'Owner', email: 'nadia@example.test' }}
          properties={[property]}
          selectedPropertyId="p1"
          onSelectProperty={() => undefined}
          onSignOut={() => undefined}
          tabs
        >
          {view === 'home' && (
            <OwnerHomePage
              firstName="Nadia"
              propertyId="p1"
              propertyName="Harbour Suite"
              month={month}
              onMonthChange={setMonth}
            />
          )}
          {view === 'statements' && <OwnerStatementsPage propertyId="p1" />}
          {view === 'calendar' && (
            <OwnerCalendarPage month={month} onMonthChange={setMonth} propertyId="p1" today="2026-10-15" />
          )}
          {view === 'damage' && <OwnerDamagePage propertyId={null} />}
          {view === 'care' && <OwnerCarePage />}
        </AppShell>
      </QueryClientProvider>
    </ApiContext.Provider>
  );
}
