import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import type { ApiClient } from '@truhost/api-client';
import type { OwnerHome, OwnerStatement } from '@truhost/shared';
import type { ReactNode } from 'react';
import { ApiContext } from '../../lib/api-context';
import { navItems } from '../../lib/nav';
import { AppShell } from '../shell/app-shell';
import { OwnerHomePage } from './owner-home';
import { OwnerStatementPage, OwnerStatementsPage } from './owner-statements';

const ok = (data: unknown) => Promise.resolve({ data, response: new Response(null, { status: 200 }) });

function renderWith(get: (path: string) => unknown, ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = createRootRoute();
  const page = createRoute({ getParentRoute: () => root, path: '/', component: () => <>{ui}</> });
  const other = createRoute({ getParentRoute: () => root, path: '$', component: () => <p>Elsewhere</p> });
  const router = createRouter({
    routeTree: root.addChildren([page, other]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  const api = { GET: vi.fn((path: string) => ok(get(path))) } as unknown as ApiClient;
  render(
    <ApiContext.Provider value={api}>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ApiContext.Provider>,
  );
  return api;
}

const HOME: OwnerHome = {
  today: '2026-10-15',
  month: '2026-10',
  properties: 1,
  latest: {
    month: '2026-09',
    statementIds: ['s1'],
    netCents: 276_215,
    grossCents: 398_000,
    nightsBooked: 12,
    releasedOn: '2026-10-05',
    change: { month: '2026-08', netCents: 250_000, changeCents: 26_215 },
  },
  thisMonth: {
    month: '2026-10',
    estimatedNetCents: 180_050,
    grossCents: 260_000,
    nightsBooked: 14,
    nightsStayed: 9,
    nightsUpcoming: 5,
    daysInMonth: 31,
    stays: 4,
    pendingPayouts: 1,
    statementExpected: '2026-11',
  },
  yearToDate: {
    year: 2026,
    months: 2,
    netCents: 526_215,
    nightsBooked: 25,
    occupancyBps: 4_200,
    avgNightlyEarningsCents: 23_922,
  },
  netByMonth: [
    { month: '2026-08', netCents: 250_000, state: 'RELEASED' },
    { month: '2026-09', netCents: 276_215, state: 'RELEASED' },
    { month: '2026-10', netCents: 180_050, state: 'IN_PROGRESS' },
  ],
  comingUp: [
    {
      bookingId: 'b1',
      property: { id: 'p1', name: 'Cedar Cabin' },
      kind: 'OWNER_STAY',
      channel: null,
      checkInDate: '2026-10-20',
      checkOutDate: '2026-10-22',
      nights: 2,
    },
  ],
  goodToKnow: [],
};

describe('owner navigation', () => {
  it('gives owners Home, Calendar, Statements and Care, all on the phone tab bar', () => {
    const items = navItems({ staffRole: null, memberships: [{ role: 'OWNER' }] });
    expect(items.filter((i) => i.tab).map((i) => i.label)).toEqual(['Home', 'Calendar', 'Statements', 'Care']);
    expect(items.map((i) => i.to)).not.toContain('/admin');
    // Admins keep the admin nav, even when they own a property.
    expect(navItems({ staffRole: 'ADMIN', memberships: [{ role: 'OWNER' }] }).some((i) => i.tab)).toBe(false);
  });

  it('shows the tab bar in the shell for owners, without the menu button on phones', async () => {
    renderWith(
      () => ({}),
      <AppShell
        nav={navItems({ staffRole: null, memberships: [{ role: 'OWNER' }] })}
        user={{ name: 'Test Owner', initials: 'TO', role: 'Owner', email: 'o@example.test' }}
        properties={[]}
        selectedPropertyId={null}
        onSelectProperty={() => undefined}
        onSignOut={() => undefined}
        tabs
      >
        <p>Page</p>
      </AppShell>,
    );
    const tabs = (await screen.findAllByRole('navigation', { name: 'Main' })).find(
      (n) => n.tagName === 'NAV' && n.className.includes('fixed'),
    )!;
    expect(
      within(tabs)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Home', 'Calendar', 'Statements', 'Care']);
    expect(screen.getByRole('button', { name: 'Open menu' }).className).toContain('hidden');
  });
});

describe('owner home', () => {
  it('leads with the released statement, then this month marked as estimated', async () => {
    renderWith(
      (p) => (p === '/v1/owner/home' ? HOME : { taxFieldsEnabled: false, contactEmail: 'hello@truhost.example' }),
      <OwnerHomePage firstName="Test" propertyId="p1" propertyName="Cedar Cabin" />,
    );
    const hero = (await screen.findByRole('heading', { name: 'September 2026 statement' })).closest('section')!;
    expect(hero.textContent).toContain('$2,762.15');
    expect(hero.textContent).toContain('Released Oct 5');
    expect(hero.textContent).toContain('+$262.15 vs August');
    expect(within(hero).getByRole('link', { name: /View statement/ })).toHaveAttribute('href', '/owner/statements/s1');
    expect(screen.getByText('Estimated')).toBeInTheDocument();
    expect(screen.getByText(/Statement ready in early November/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /9 nights stayed and 5 still to come/ })).toBeInTheDocument();
    expect(screen.getByText('Owner stay')).toBeInTheDocument();
    // Nothing to know: the card stays hidden.
    expect(screen.queryByText('Good to know')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Message TruHost/ })).toHaveAttribute(
      'href',
      expect.stringContaining('mailto:hello@truhost.example'),
    );
  });

  it('explains when the first statement arrives before there is one', async () => {
    renderWith(
      (p) => (p === '/v1/owner/home' ? { ...HOME, latest: null } : {}),
      <OwnerHomePage firstName="Test" propertyId={null} propertyName={null} />,
    );
    expect(await screen.findByText('Your first statement is on its way')).toBeInTheDocument();
    expect(screen.getByText(/expected in early November/)).toBeInTheDocument();
  });
});

describe('owner statements', () => {
  it('lists released statements with a PDF download, and says when there are none', async () => {
    renderWith(
      () => ({
        items: [
          {
            id: 's1',
            property: { id: 'p1', name: 'Cedar Cabin' },
            month: '2026-09',
            netCents: 276_215,
            grossCents: 398_000,
            releasedOn: '2026-10-05',
          },
        ],
      }),
      <OwnerStatementsPage propertyId={null} />,
    );
    expect(await screen.findByRole('link', { name: 'September 2026' })).toHaveAttribute('href', '/owner/statements/s1');
    expect(screen.getByText('$2,762.15')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download the September 2026 statement PDF' })).toBeInTheDocument();
  });

  it('shows the summary with the plan rate, the stay split, and the payment', async () => {
    const st: OwnerStatement = {
      id: 's1',
      property: { id: 'p1', name: 'Cedar Cabin' },
      month: '2026-09',
      plan: { name: 'TruPlan', managementFeeBps: 2200 },
      totals: {
        nightsBooked: 2,
        grossCents: 40_000,
        managementFeeBps: 2200,
        managementFeeCents: 8_800,
        expensesCents: 0,
        ownerStayCleaningCents: 0,
        adjustmentsCents: 0,
        netCents: 31_200,
      },
      lines: [
        {
          kind: 'STAY',
          bookingId: 'b1',
          expenseId: null,
          adjustmentId: null,
          date: '2026-08-30',
          endDate: '2026-09-03',
          channel: 'AIRBNB',
          category: null,
          description: 'Airbnb stay',
          detail: null,
          nights: 2,
          totalNights: 4,
          stayGrossCents: 80_000,
          cancelled: false,
          payoutPending: false,
          amountCents: 40_000,
        },
      ],
      released: { on: '2026-10-05', paymentReference: 'ETF-88412' },
    };
    renderWith(() => st, <OwnerStatementPage statementId="s1" />);
    expect(await screen.findByText('TruPlan fee')).toBeInTheDocument();
    expect(screen.getByText('22% of gross revenue')).toBeInTheDocument();
    expect(screen.getByText('Net to you')).toBeInTheDocument();
    expect(screen.getByText(/2 of 4 nights in September/)).toBeInTheDocument();
    expect(screen.getByText('of $800.00 for the stay')).toBeInTheDocument();
    expect(screen.getAllByText('ETF-88412').length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByRole('button', { name: /Download PDF/ })).toBeEnabled());
  });
});
