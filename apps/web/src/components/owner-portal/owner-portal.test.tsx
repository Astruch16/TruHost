import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import type { ApiClient } from '@truhost/api-client';
import type { OwnerCalendar, OwnerHome, OwnerMonth, OwnerStatement, OwnerSupplies } from '@truhost/shared';
import { useState, type ReactNode } from 'react';
import { ApiContext } from '../../lib/api-context';
import { navItems } from '../../lib/nav';
import { AppShell } from '../shell/app-shell';
import { OwnerHomePage } from './owner-home';
import { OwnerStatementPage, OwnerStatementsPage } from './owner-statements';
import { OwnerSuppliesCard } from './supplies-card';
import { GoodToKnowCard } from './good-to-know';
import { YearToDateCard } from './year-card';
import { OwnerDamagePage } from './owner-damage';
import { OwnerCalendarPage } from './owner-calendar';
import { DEV_DAMAGE } from '../../lib/dev-damage-fixtures';

const ok = (data: unknown) => Promise.resolve({ data, response: new Response(null, { status: 200 }) });

function renderWith(get: (path: string, init?: { params?: { query?: { month?: string } } }) => unknown, ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = createRootRoute();
  const page = createRoute({ getParentRoute: () => root, path: '/', component: () => <>{ui}</> });
  const other = createRoute({ getParentRoute: () => root, path: '$', component: () => <p>Elsewhere</p> });
  const router = createRouter({
    routeTree: root.addChildren([page, other]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  const api = {
    GET: vi.fn((path: string, init?: { params?: { query?: { month?: string } } }) => ok(get(path, init))),
  } as unknown as ApiClient;
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

const CONFIG = { taxFieldsEnabled: false, contactEmail: 'hello@truhost.example' };

const supply = (id: string, name: string, levelPct: number | null, urgency: 'OUT' | 'LOW' | 'SOON' | null) => ({
  id,
  propertyId: 'p1',
  name,
  category: 'KITCHEN' as const,
  thresholdPct: 25,
  position: 0,
  levelPct,
  state: (levelPct === null ? 'UNKNOWN' : levelPct === 0 ? 'OUT' : levelPct <= 25 ? 'LOW' : 'OK') as
    'UNKNOWN' | 'OUT' | 'LOW' | 'OK',
  lastCheckedAt: '2026-10-14T18:00:00.000Z',
  archivedAt: null,
  urgency,
});

const SUPPLIES: OwnerSupplies = {
  properties: [
    {
      property: { id: 'p1', name: 'Cedar Cabin' },
      items: [
        supply('s1', 'Coffee pods', 0, 'OUT'),
        supply('s2', 'Toilet paper', 50, 'SOON'),
        supply('s3', 'Dish soap', 100, null),
        supply('s4', 'Shampoo', 75, null),
        supply('s5', 'Paper towels', 100, null),
        supply('s6', 'Body wash', 75, null),
        supply('s7', 'Hand soap', 100, null),
        supply('s8', 'Dryer sheets', 75, null),
      ],
      counts: { total: 8, out: 1, low: 0, soon: 1, unchecked: 0 },
      lastCheckedAt: '2026-10-14T18:00:00.000Z',
    },
  ],
};

describe('owner navigation', () => {
  it('gives owners Home, Calendar, Statements, Damage and Care, all on the phone tab bar', () => {
    const items = navItems({ staffRole: null, memberships: [{ role: 'OWNER' }] });
    expect(items.filter((i) => i.tab).map((i) => i.label)).toEqual([
      'Home',
      'Calendar',
      'Statements',
      'Damage',
      'Care',
    ]);
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
    ).toEqual(['Home', 'Calendar', 'Statements', 'Damage', 'Care']);
    expect(screen.getByRole('button', { name: 'Open menu' }).className).toContain('hidden');
  });
});

const SEPTEMBER: OwnerMonth = {
  month: '2026-09',
  basis: 'RELEASED',
  statementIds: ['s1'],
  releasedOn: '2026-10-05',
  netCents: 276_215,
  grossCents: 398_000,
  managementFeeCents: 87_560,
  expensesCents: 38_475,
  adjustmentsCents: 4_250,
  nightsBooked: 12,
  estimatedProperties: 0,
  change: { month: '2026-08', netCents: 250_000, changeCents: 26_215 },
  timing: 'PAST',
};
const OCTOBER: OwnerMonth = {
  ...SEPTEMBER,
  month: '2026-10',
  basis: 'ESTIMATE',
  statementIds: [],
  releasedOn: null,
  netCents: 180_050,
  adjustmentsCents: 0,
  change: { month: '2026-09', netCents: 276_215, changeCents: -96_165 },
  timing: 'CURRENT',
};

/** The owner API as Home reads it; `month` answers by the month asked for. */
const homeApi = (home: OwnerHome) => (path: string, init?: { params?: { query?: { month?: string } } }) =>
  path === '/v1/owner/home'
    ? home
    : path === '/v1/owner/month'
      ? init?.params?.query?.month === '2026-10'
        ? OCTOBER
        : SEPTEMBER
      : path === '/v1/owner/supplies'
        ? SUPPLIES
        : path === '/v1/owner/properties'
          ? { items: [] }
          : CONFIG;

/** Home with the month held in state, as the route keeps it in the URL. */
function HomeWithMonth() {
  const [month, setMonth] = useState<string | null>(null);
  return (
    <OwnerHomePage firstName="Test" propertyId="p1" propertyName="Cedar Cabin" month={month} onMonthChange={setMonth} />
  );
}

describe('owner home', () => {
  it('opens on the latest released statement, and steps to other months, estimated when not released', async () => {
    const api = renderWith(homeApi(HOME), <HomeWithMonth />);
    const hero = (await screen.findByRole('heading', { name: 'September 2026 statement' })).closest('section')!;
    await waitFor(() => expect(hero.textContent).toContain('$2,762.15'));
    expect(hero.textContent).toContain('Released Oct 5');
    expect(hero.textContent).toContain('+$262.15');
    expect(hero.textContent).toContain('−$875.60');
    expect(within(hero).getByRole('link', { name: /View statement/ })).toHaveAttribute('href', '/owner/statements/s1');

    await userEvent.click(within(hero).getByRole('button', { name: 'Next month' }));
    const october = (await screen.findByRole('heading', { name: 'October 2026 earnings' })).closest('section')!;
    await waitFor(() => expect(october.textContent).toContain('$1,800.50'));
    expect(october.textContent).toContain('In progress · estimated');
    expect(october.textContent).toContain('Estimated net to you');
    expect(within(october).getByRole('link', { name: /See the stays/ })).toHaveAttribute(
      'href',
      '/owner/calendar?month=2026-10',
    );
    expect(api.GET).toHaveBeenCalledWith('/v1/owner/month', {
      params: { query: { month: '2026-10', propertyId: 'p1' } },
    });

    expect(screen.getByText(/Statement ready in early November/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /9 nights stayed and 5 still to come/ })).toBeInTheDocument();
    expect(screen.getByText('Owner stay')).toBeInTheDocument();
    expect(screen.queryByText('Good to know')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Message TruHost/ })).toHaveAttribute(
      'href',
      expect.stringContaining('mailto:hello@truhost.example'),
    );
  });

  it('opens on this month before the first release, saying when the first statement arrives', async () => {
    const first = { ...HOME, latest: null };
    renderWith(homeApi(first), <HomeWithMonth />);
    expect(await screen.findByRole('heading', { name: 'October 2026 earnings' })).toBeInTheDocument();
    expect(await screen.findByText(/Your first statement arrives in early November/)).toBeInTheDocument();
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

describe('owner supplies', () => {
  it('lists what to restock first with each level, and the rest on request', async () => {
    renderWith(() => ({}), <OwnerSuppliesCard data={SUPPLIES} />);
    expect(await screen.findByText(/1 out · 1 low soon · 6 stocked/)).toBeInTheDocument();
    expect(screen.getAllByRole('meter').map((m) => m.getAttribute('aria-label'))).toEqual([
      'Coffee pods level',
      'Toilet paper level',
      'Dish soap level',
      'Shampoo level',
      'Paper towels level',
      'Body wash level',
    ]);
    expect(screen.getByText('Out')).toBeInTheDocument();
    expect(screen.getByText('Low soon')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show all 8 items' }));
    expect(screen.getAllByRole('meter')).toHaveLength(8);
    expect(screen.getByRole('button', { name: 'Show fewer' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('says so when no supplies are tracked yet', async () => {
    const empty = {
      ...SUPPLIES.properties[0]!,
      items: [],
      counts: { total: 0, out: 0, low: 0, soon: 0, unchecked: 0 },
      lastCheckedAt: null,
    };
    renderWith(() => ({}), <OwnerSuppliesCard data={{ properties: [empty] }} />);
    expect(await screen.findByText('No supplies tracked yet')).toBeInTheDocument();
  });
});

describe('owner calendar', () => {
  const stay = (over: Partial<OwnerCalendar['items'][number]>): OwnerCalendar['items'][number] => ({
    bookingId: 'b1',
    property: { id: 'p1', name: 'Cedar Cabin' },
    kind: 'GUEST',
    channel: 'AIRBNB',
    checkInDate: '2026-10-07',
    checkOutDate: '2026-10-12',
    nights: 5,
    nightsInMonth: 5,
    ownerGrossCents: 86_250,
    monthShareCents: 86_250,
    payoutPending: false,
    ...over,
  });
  const CAL: OwnerCalendar = {
    month: '2026-10',
    items: [
      stay({}),
      stay({
        bookingId: 'b2',
        channel: 'VRBO',
        checkInDate: '2026-10-29',
        checkOutDate: '2026-11-02',
        nights: 4,
        nightsInMonth: 3,
        ownerGrossCents: 80_000,
        monthShareCents: 60_000,
      }),
      stay({
        bookingId: 'b3',
        kind: 'GUEST',
        channel: 'DIRECT',
        ownerGrossCents: null,
        monthShareCents: null,
        payoutPending: true,
      }),
      stay({ bookingId: 'b4', kind: 'OWNER_STAY', channel: null, ownerGrossCents: null, monthShareCents: null }),
    ],
  };

  it('lists each stay as its own tile with the month share, and opens its details', async () => {
    renderWith(
      () => CAL,
      <OwnerCalendarPage month="2026-10" onMonthChange={() => {}} propertyId="p1" today="2026-10-19" />,
    );
    const glance = (await screen.findByRole('heading', { name: 'October 2026 at a glance' })).closest('section')!;
    expect(glance.textContent).toContain('4 stays');
    const tiles = within(glance).getAllByRole('button');
    expect(tiles).toHaveLength(4);
    expect(tiles[0]!.textContent).toContain('Airbnb guest');
    expect(tiles[0]!.textContent).toContain('$862.50');
    expect(tiles[0]!.textContent).toContain('Your share');
    expect(tiles[1]!.textContent).toContain('4 nights · 3 in October');
    expect(tiles[1]!.textContent).toContain('$600.00');
    expect(tiles[1]!.textContent).toContain('Your share in Oct');
    expect(tiles[2]!.textContent).toContain('Payout pending');
    expect(tiles[3]!.textContent).toContain('Owner stay');

    await userEvent.click(tiles[1]!);
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('$800.00');
    expect(dialog.textContent).toContain('4 (3 in October)');
  });

  it('says when nothing is booked', async () => {
    renderWith(
      () => ({ month: '2026-10', items: [] }),
      <OwnerCalendarPage month="2026-10" onMonthChange={() => {}} propertyId="p1" today="2026-10-19" />,
    );
    expect(await screen.findByText('Nothing booked this month')).toBeInTheDocument();
  });
});

describe('owner damage', () => {
  it('lists the reports read through the owner API, and opens one read-only', async () => {
    const owned = DEV_DAMAGE.filter((r) => r.status !== 'DRAFT').map((r) => ({
      ...r,
      booking: r.booking && { ...r.booking, guestName: null },
      can: { edit: false, addPhotos: false, submit: false, manage: false },
    }));
    const api = renderWith(
      (p) => (p === '/v1/owner/damage' ? { items: owned } : owned[0]),
      <OwnerDamagePage propertyId={null} />,
    );
    const first = await screen.findByRole('button', { name: new RegExp(owned[0]!.title) });
    await userEvent.click(first);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: /Add photos|Send|Mark/ })).not.toBeInTheDocument();
    expect(api.GET).toHaveBeenCalledWith('/v1/owner/damage/{id}', { params: { path: { id: owned[0]!.id } } });
    expect(api.GET).not.toHaveBeenCalledWith('/v1/damage-reports/{id}', expect.anything());
  });

  it('says so when nothing has been reported', async () => {
    renderWith(() => ({ items: [] }), <OwnerDamagePage propertyId="p1" />);
    expect(await screen.findByText('No damage reported')).toBeInTheDocument();
  });
});

describe('good to know', () => {
  const items: OwnerHome['goodToKnow'] = [
    {
      id: 'e1',
      kind: 'EXPENSE',
      date: '2026-10-15',
      property: { id: 'p2', name: 'Seaside Loft' },
      title: 'Netflix Standard',
      detail: 'Subscriptions from Netflix, paid from your earnings',
      category: 'SUBSCRIPTIONS',
      vendor: 'Netflix',
      statementMonth: null,
      amountCents: -1_899,
      receiptFileId: 'f1',
      statementId: null,
    },
    {
      id: 'l1',
      kind: 'ADJUSTMENT',
      date: '2026-10-05',
      property: { id: 'p1', name: 'Cedar Cabin' },
      title: 'Late Vrbo payout',
      detail: 'Added to your September statement',
      category: null,
      vendor: null,
      statementMonth: '2026-09',
      amountCents: 4_250,
      receiptFileId: null,
      statementId: 's1',
    },
  ];

  it('labels each item by kind, with its date, place, amount and receipt or statement', async () => {
    const onViewReceipt = vi.fn();
    renderWith(() => ({}), <GoodToKnowCard items={items} showProperty onViewReceipt={onViewReceipt} />);
    const [expense, adjustment] = await screen.findAllByRole('listitem');
    expect(expense!.textContent).toContain('Subscriptions');
    expect(expense!.textContent).toContain('Subscriptions · Netflix');
    expect(within(expense!).getByText('Seaside Loft')).toBeInTheDocument();
    expect(expense!.textContent).toContain('−$18.99');
    expect(expense!.textContent).toContain('Oct 15');
    await userEvent.click(within(expense!).getByRole('button', { name: /View receipt/ }));
    expect(onViewReceipt).toHaveBeenCalledWith('f1');

    expect(adjustment!.textContent).toContain('Credit');
    expect(adjustment!.textContent).toContain('Credit · September statement');
    expect(within(adjustment!).getByText('Cedar Cabin')).toBeInTheDocument();
    expect(adjustment!.textContent).toContain('+$42.50');
    expect(within(adjustment!).getByRole('link', { name: /View statement/ })).toHaveAttribute(
      'href',
      '/owner/statements/s1',
    );
  });
});

describe('year to date', () => {
  it('says how much of the year is covered, with each figure labelled', async () => {
    renderWith(() => ({}), <YearToDateCard ytd={HOME.yearToDate} month="2026-10" />);
    expect(await screen.findByRole('heading', { name: '2026 so far' })).toBeInTheDocument();
    expect(screen.getByText('2 of 10 months released')).toBeInTheDocument();
    expect(screen.getByText(/so every figure is final/)).toBeInTheDocument();
    const net = screen.getByText('Net to you').parentElement!;
    expect(net.textContent).toContain('$5,262.15');
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByText('Avg. nightly earnings').parentElement!.textContent).toContain('$239.22');
  });

  it('explains the figures fill in before the first release', async () => {
    renderWith(
      () => ({}),
      <YearToDateCard
        ytd={{ year: 2026, months: 0, netCents: 0, nightsBooked: 0, occupancyBps: null, avgNightlyEarningsCents: null }}
        month="2026-10"
      />,
    );
    expect(await screen.findByText('0 of 10 months released')).toBeInTheDocument();
    expect(screen.getByText(/fill in as your monthly statements are released/)).toBeInTheDocument();
  });
});

describe('switching property', () => {
  /** Home with a "switch" button standing in for the top-bar switcher. */
  function Switchable() {
    const [propertyId, setPropertyId] = useState<string | null>('p1');
    return (
      <>
        <button type="button" onClick={() => setPropertyId('p2')}>
          switch
        </button>
        <OwnerHomePage
          firstName="Test"
          propertyId={propertyId}
          propertyName={null}
          month={null}
          onMonthChange={() => undefined}
        />
      </>
    );
  }

  it('keeps the page on screen, dimmed, until the next property arrives, and loads the others ahead', async () => {
    let releaseP2: (v: unknown) => void = () => undefined;
    const p2 = new Promise((resolve) => (releaseP2 = resolve));
    const owned = {
      items: [{ id: 'p1' }, { id: 'p2' }].map((p) => ({ ...p, name: p.id, city: 'X', province: 'BC', photo: null })),
    };
    const get = vi.fn((path: string, init?: { params?: { query?: { propertyId?: string } } }) => {
      if (path === '/v1/owner/properties') return ok(owned);
      if (path === '/v1/owner/home' && init?.params?.query?.propertyId === 'p2') {
        return p2.then(() => ({
          data: { ...HOME, latest: { ...HOME.latest!, netCents: 111_111 } },
          response: new Response(null),
        }));
      }
      return ok(homeApi(HOME)(path, init as never));
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const root = createRootRoute();
    const page = createRoute({ getParentRoute: () => root, path: '/', component: Switchable });
    const router = createRouter({
      routeTree: root.addChildren([page]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    });
    render(
      <ApiContext.Provider value={{ GET: get } as unknown as ApiClient}>
        <QueryClientProvider client={client}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </ApiContext.Provider>,
    );
    await screen.findByRole('heading', { name: 'September 2026 statement' });

    // The other choices ("All properties" and p2) are requested in the background once the page settles.
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/v1/owner/home', { params: { query: { propertyId: 'p2' } } }),
    );
    expect(get).toHaveBeenCalledWith('/v1/owner/home', { params: { query: { propertyId: undefined } } });

    await userEvent.click(screen.getByRole('button', { name: 'switch' }));
    // While p2 is on its way: no skeletons, the current figures stay, marked busy.
    expect(screen.queryByRole('status', { name: 'Loading your home page' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'September 2026 statement' })).toBeInTheDocument();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();

    releaseP2(null);
    await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull());
  });
});
