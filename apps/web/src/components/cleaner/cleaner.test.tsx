import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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
import type { Clean, CleanChecklist, CleanSummary } from '@truhost/shared';
import type { ReactNode } from 'react';
import { ApiContext } from '../../lib/api-context';
import { addDays, todayIso } from '../../lib/dates';
import { CleanPage } from './clean-page';
import { CleanerSchedulePage } from './schedule-page';

const today = todayIso();

const summary = (over: Partial<CleanSummary> = {}): CleanSummary => ({
  id: 'c1',
  property: { id: 'p1', name: 'Cedar Cabin', city: 'Whistler' },
  kind: 'TURNOVER',
  status: 'SCHEDULED',
  scheduledDate: today,
  stay: { kind: 'GUEST', checkInDate: addDays(today, -3), checkOutDate: today },
  window: { from: { date: today, time: '11:00' }, until: { date: today, time: '16:00' } },
  assignedCleaner: { id: 'u1', firstName: 'Casey', lastName: 'Clean' },
  cleanerPayCents: 9000,
  notes: null,
  startedAt: null,
  completedAt: null,
  cancelledAt: null,
  cancelReason: null,
  progress: { rooms: 2, done: 0 },
  ...over,
});

const photo = (roomId: string, phase: 'BEFORE' | 'AFTER') => ({
  id: `${roomId}-${phase}`,
  roomId,
  phase,
  url: 'https://files.example/large.jpg',
  thumbUrl: 'https://files.example/thumb.jpg',
  expiresAt: '2026-11-20T21:00:00Z',
  uploadedBy: { id: 'u1', firstName: 'Casey', lastName: 'Clean' },
  createdAt: '2026-11-20T19:00:00Z',
});

const checklist = (over: Partial<CleanChecklist> = {}): CleanChecklist => ({
  beforePhotos: { done: false },
  damage: { found: null, reports: [], done: false },
  stockCount: { items: 2, counted: 0, done: false, restock: [] },
  afterPhotos: { done: false },
  current: null,
  ...over,
});
const CAN_NONE = {
  start: false,
  addPhotos: false,
  addAfterPhotos: false,
  checkDamage: false,
  countStock: false,
  complete: false,
  book: false,
};

const detail = (over: Partial<Clean> = {}): Clean => ({
  ...summary(),
  rooms: [
    { id: 'r1', displayName: 'Bedroom', before: [], after: [] },
    { id: 'r2', displayName: 'Bathroom', before: [], after: [] },
  ],
  checklist: checklist(),
  today,
  can: { ...CAN_NONE, start: true },
  ...over,
});

/** A clean under way at `current`, every step before it done. */
const working = (current: CleanChecklist['current'], over: Partial<Clean> = {}): Clean => {
  const at = ['BEFORE_PHOTOS', 'DAMAGE', 'STOCK_COUNT', 'AFTER_PHOTOS', 'FINISH'].indexOf(current ?? 'FINISH');
  const shot = (r: string, phase: 'BEFORE' | 'AFTER', step: number) => (at > step ? [photo(r, phase)] : []);
  return detail({
    status: 'IN_PROGRESS',
    rooms: [
      { id: 'r1', displayName: 'Bedroom', before: shot('r1', 'BEFORE', 0), after: shot('r1', 'AFTER', 3) },
      { id: 'r2', displayName: 'Bathroom', before: shot('r2', 'BEFORE', 0), after: shot('r2', 'AFTER', 3) },
    ],
    checklist: checklist({
      current,
      beforePhotos: { done: at > 0 },
      damage: { found: at > 1 ? false : null, reports: [], done: at > 1 },
      stockCount: { items: 2, counted: at > 2 ? 2 : 0, done: at > 2, restock: [] },
      afterPhotos: { done: at > 3 },
    }),
    can: {
      ...CAN_NONE,
      addPhotos: true,
      checkDamage: at >= 1,
      countStock: at >= 2,
      addAfterPhotos: at >= 3,
      complete: at >= 4,
    },
    ...over,
  });
};

const supply = (id: string, name: string, levelPct: number | null = null) => ({
  id,
  propertyId: 'p1',
  name,
  category: 'OTHER',
  thresholdPct: 25,
  position: 0,
  levelPct,
  state: levelPct === null ? 'UNKNOWN' : 'OK',
  lastCheckedAt: null,
  archivedAt: null,
});

const ok = (data: unknown, status = 200) => Promise.resolve({ data, response: new Response(null, { status }) });
/** GET for the walkthrough: the clean; every list it opens (supplies, rooms, stays) empty. */
const getFor = (clean: Clean) => vi.fn((path: string) => (path === '/v1/cleans/{id}' ? ok(clean) : ok({ items: [] })));
const fail = (status: number, error: object) => Promise.resolve({ error, response: new Response(null, { status }) });

function renderWith(api: Partial<ApiClient>, ui: ReactNode) {
  const root = createRootRoute();
  const page = createRoute({ getParentRoute: () => root, path: '/', component: () => <>{ui}</> });
  const other = createRoute({ getParentRoute: () => root, path: '$', component: () => <p>Elsewhere</p> });
  const router = createRouter({
    routeTree: root.addChildren([page, other]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <ApiContext.Provider value={api as ApiClient}>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ApiContext.Provider>,
  );
}

/** GET /v1/cleans as the API answers it: only the cleans in the asked-for range; supplies empty. */
const cleansApi = (items: CleanSummary[], supplies: Record<string, unknown[]> = {}) =>
  vi.fn(
    (
      path: string,
      init?: { params?: { path?: { id?: string }; query?: { from?: string; to?: string; assignee?: string } } },
    ) => {
      if (path === '/v1/properties/{id}/supplies') return ok({ items: supplies[init?.params?.path?.id ?? ''] ?? [] });
      if (path !== '/v1/cleans') return ok({ items: [] });
      const { from = '0000', to = '9999', assignee } = init?.params?.query ?? {};
      return ok({
        items: items.filter(
          (c) =>
            c.scheduledDate >= from && c.scheduledDate <= to && (assignee !== 'none' || c.assignedCleaner === null),
        ),
      });
    },
  );

describe('cleaner schedule', () => {
  it('shows today’s cleans with the window, the week on a board, and what was done in the rail', async () => {
    const items = [
      summary(),
      summary({ id: 'c3', scheduledDate: addDays(today, -2), status: 'COMPLETE', completedAt: '2026-11-18T22:00:00Z' }),
    ];
    renderWith({ GET: cleansApi(items) } as unknown as ApiClient, <CleanerSchedulePage />);
    const todayCard = (await screen.findByRole('link', { name: 'Cedar Cabin' })).closest('li')!;
    expect(todayCard).toHaveTextContent('Free from 11 AM');
    expect(todayCard).toHaveTextContent('Ready by 4 PM');
    expect(todayCard).toHaveTextContent('Start the clean');
    const board = screen.getByRole('region', { name: 'This week' });
    expect(
      within(board)
        .getAllByRole('link')
        .map((l) => l.getAttribute('href')),
    ).toContain('/cleaner/cleans/c1');
    expect(
      within(screen.getByRole('region', { name: 'Recently done' })).getByText(/2 rooms photographed/),
    ).toBeInTheDocument();
  });

  it('puts the next clean beside a lone one today (wide screens, where they sit two to a row)', async () => {
    renderWith(
      { GET: cleansApi([summary(), summary({ id: 'n1', scheduledDate: addDays(today, 3) })]) } as unknown as ApiClient,
      <CleanerSchedulePage />,
    );
    const upNext = (await screen.findByRole('link', { name: /^Up next: Cedar Cabin/ })).closest('li')!;
    expect(upNext.className).toContain('hidden');
    expect(upNext.className).toContain('@3xl/content:flex');
    expect(within(upNext).getByRole('link')).toHaveAttribute('href', '/cleaner/cleans/n1');
    expect(upNext).toHaveTextContent('Up next · In 3 days');
    expect(upNext).toHaveTextContent('Ready by 4 PM');
  });

  it('says nothing else is booked beside a lone clean today when there’s nothing next', async () => {
    renderWith({ GET: cleansApi([summary()]) } as unknown as ApiClient, <CleanerSchedulePage />);
    expect(await screen.findByText('Nothing else booked yet')).toBeInTheDocument();
  });

  it('leaves two cleans today side by side, with nothing next to fill', async () => {
    renderWith(
      {
        GET: cleansApi([
          summary(),
          summary({ id: 'c2', property: { id: 'p2', name: 'Seaside Loft', city: 'Tofino' } }),
          summary({ id: 'n1', scheduledDate: addDays(today, 3) }),
        ]),
      } as unknown as ApiClient,
      <CleanerSchedulePage />,
    );
    expect(await screen.findByRole('link', { name: 'Seaside Loft' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Up next/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Nothing else booked yet')).not.toBeInTheDocument();
  });

  it('moves through the weeks, narrows to a property, and jumps to a day picked on the calendar', async () => {
    const cedar = { id: 'p1', name: 'Cedar Cabin', city: 'Whistler' };
    const seaside = { id: 'p2', name: 'Seaside Loft', city: 'Tofino' };
    const items = [
      summary({ id: 'a', scheduledDate: today, property: cedar }),
      summary({ id: 'b', scheduledDate: today, property: seaside }),
      summary({ id: 'c', scheduledDate: addDays(today, 7), property: seaside }),
    ];
    renderWith({ GET: cleansApi(items) } as unknown as ApiClient, <CleanerSchedulePage />);
    const boardLinks = (name: string) =>
      within(screen.getByRole('region', { name }))
        .getAllByRole('link')
        .map((l) => l.getAttribute('href'));
    expect(await screen.findByRole('region', { name: 'This week' })).toBeInTheDocument();
    expect(boardLinks('This week')).toEqual(['/cleaner/cleans/a', '/cleaner/cleans/b']);

    const chips = screen.getByRole('group', { name: 'Property' });
    await userEvent.click(within(chips).getByRole('button', { name: 'Seaside Loft' }));
    expect(boardLinks('This week')).toEqual(['/cleaner/cleans/b']);
    await userEvent.click(within(chips).getByRole('button', { name: 'All properties' }));

    await userEvent.click(screen.getByRole('button', { name: 'Week after' }));
    expect(await screen.findByRole('region', { name: 'Next week' })).toBeInTheDocument();
    expect(boardLinks('Next week')).toEqual(['/cleaner/cleans/c']);
    await userEvent.click(screen.getByRole('button', { name: 'This week' }));
    expect(await screen.findByRole('region', { name: 'This week' })).toBeInTheDocument();

    // Picking next week's day on the calendar (when it's in this month) jumps the board to that week.
    const day = addDays(today, 7);
    if (day.slice(0, 7) === today.slice(0, 7)) {
      await userEvent.click(screen.getByRole('button', { name: /1 clean \(Seaside Loft\)/ }));
      expect(await screen.findByRole('region', { name: 'Next week' })).toBeInTheDocument();
    }
  });

  it('lists the properties ahead with their next clean, and supplies to check there', async () => {
    const items = [
      summary({ id: 'n1', scheduledDate: addDays(today, 1) }),
      summary({ id: 'n2', scheduledDate: addDays(today, 3) }),
    ];
    const supplies = {
      p1: [
        { id: 's1', name: 'Dish soap', state: 'OK', levelPct: 100, thresholdPct: 25, lastCheckedAt: null },
        { id: 's2', name: 'Paper towels', state: 'LOW', levelPct: 25, thresholdPct: 25, lastCheckedAt: null },
        { id: 's3', name: 'Coffee pods', state: 'OUT', levelPct: 0, thresholdPct: 25, lastCheckedAt: null },
        { id: 's4', name: 'Shampoo', state: 'UNKNOWN', levelPct: null, thresholdPct: 25, lastCheckedAt: null },
      ],
    };
    renderWith({ GET: cleansApi(items, supplies) } as unknown as ApiClient, <CleanerSchedulePage />);
    const properties = await screen.findByRole('region', { name: 'Your properties' });
    expect(within(properties).getByRole('link', { name: /Cedar Cabin/ })).toHaveAttribute(
      'href',
      '/cleaner/properties/p1',
    );
    expect(properties).toHaveTextContent('2 ahead');
    const check = await screen.findByRole('region', { name: 'Check on your next visit' });
    // A count of each, then the property's items worst first, each with its level.
    const counts = within(check).getByRole('list', { name: 'Supplies to check' });
    expect(
      within(counts)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['1 out', '1 low', '1 not checked']);
    const list = within(check).getByRole('list', { name: 'Cedar Cabin supplies' });
    expect(
      within(list)
        .getAllByRole('meter')
        .map((m) => m.getAttribute('aria-label')),
    ).toEqual(['Coffee pods level', 'Paper towels level', 'Shampoo level']);
    expect(within(check).getByRole('link', { name: /Cedar Cabin/ })).toHaveAttribute('href', '/cleaner/properties/p1');
  });

  it('shades approved time off on the calendar', async () => {
    const day = today.slice(8) === '28' || today.slice(8) > '28' ? today : addDays(today, 1);
    const cleans = cleansApi([summary({ id: 'n1', scheduledDate: addDays(today, 3) })]);
    const GET = vi.fn((path: string, init?: object) =>
      path === '/v1/time-off'
        ? ok({ items: [{ startDate: day, endDate: day, status: 'APPROVED' }] })
        : cleans(path, init as never),
    );
    renderWith({ GET } as unknown as ApiClient, <CleanerSchedulePage />);
    expect(await screen.findByText('Your time off')).toBeInTheDocument();
    expect(screen.getByLabelText(/, time off$/)).toBeInTheDocument();
  });

  it('starts today’s clean straight from its card, then opens it', async () => {
    const GET = cleansApi([summary()]);
    const POST = vi.fn(() => ok(detail({ status: 'IN_PROGRESS', can: { ...CAN_NONE, addPhotos: true } })));
    renderWith({ GET, POST } as unknown as ApiClient, <CleanerSchedulePage />);
    const card = (await screen.findByRole('link', { name: 'Cedar Cabin' })).closest('li')!;
    await userEvent.click(within(card).getByRole('button', { name: /Start the clean/ }));
    expect(POST).toHaveBeenCalledWith('/v1/cleans/{id}/start', { params: { path: { id: 'c1' } } });
    expect(await screen.findByText('Elsewhere')).toBeInTheDocument(); // the clean's page
  });

  it('lists open cleans with what they pay, and books one (or says someone else got it)', async () => {
    const openOne = summary({
      id: 'o1',
      scheduledDate: addDays(today, 2),
      assignedCleaner: null,
      cleanerPayCents: 8500,
      property: { id: 'p2', name: 'Seaside Loft', city: 'Tofino' },
    });
    const openTwo = summary({
      id: 'o2',
      scheduledDate: addDays(today, 4),
      assignedCleaner: null,
      cleanerPayCents: 7000,
    });
    const GET = vi.fn((path: string, init?: { params?: { query?: { assignee?: string } } }) =>
      path === '/v1/cleans' && init?.params?.query?.assignee === 'none'
        ? ok({ items: [openOne, openTwo] })
        : ok({ items: [] }),
    );
    const POST = vi
      .fn()
      .mockImplementationOnce(() =>
        ok({ ...openOne, assignedCleaner: { id: 'u1', firstName: 'Casey', lastName: 'Clean' } }),
      )
      .mockImplementationOnce(() =>
        fail(409, { code: 'CLEAN_TAKEN', title: 'Conflict', detail: 'Another cleaner has just booked this clean.' }),
      );
    renderWith({ GET, POST } as unknown as ApiClient, <CleanerSchedulePage />);
    const open = await screen.findByRole('region', { name: 'Open cleans' });
    const first = within(open).getByRole('listitem', { name: /^Seaside Loft/ });
    expect(first).toHaveTextContent('$85.00');
    expect(first).toHaveTextContent('Free from 11 AM');
    await userEvent.click(within(first).getByRole('button', { name: 'Book this clean' }));
    expect(POST).toHaveBeenCalledWith('/v1/cleans/{id}/book', { params: { path: { id: 'o1' } } });
    expect(await within(open).findByRole('status')).toHaveTextContent('Booked: Seaside Loft');
    const second = within(open).getByRole('listitem', { name: /^Cedar Cabin/ });
    await userEvent.click(within(second).getByRole('button', { name: 'Book this clean' }));
    expect(await within(second).findByRole('alert')).toHaveTextContent('Another cleaner has just booked this one.');
  });

  it('says when there’s nothing today, and when the next clean is', async () => {
    const items = [summary({ id: 'c2', scheduledDate: addDays(today, 2) })];
    renderWith({ GET: cleansApi(items) } as unknown as ApiClient, <CleanerSchedulePage />);
    expect(await screen.findByRole('heading', { name: 'Nothing to clean today' })).toBeInTheDocument();
    const hero = screen.getByRole('region', { name: 'Nothing to clean today' });
    expect(hero).toHaveTextContent(/Next up: Cedar Cabin/);
    expect(within(hero).getByRole('link', { name: /Open the next clean/ })).toHaveAttribute(
      'href',
      '/cleaner/cleans/c2',
    );
    // Every card keeps its place in the grid, saying when it has nothing.
    expect(
      await within(screen.getByRole('region', { name: 'Check on your next visit' })).findByText(
        'Everything’s stocked at the places you’re cleaning next.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Recently done' })).toHaveTextContent(
      'Cleans you complete will show here.',
    );
    expect(screen.getByRole('region', { name: 'Your properties' })).toHaveTextContent('Cedar Cabin');
  });
});

describe('a clean’s walkthrough', () => {
  const step = (n: number, title: string) => screen.getByRole('listitem', { name: new RegExp(`^Step ${n}: ${title}`) });

  it('starts on its day, then opens the checklist at the before photos, the rest locked', async () => {
    const POST = vi.fn(() => ok(working('BEFORE_PHOTOS')));
    renderWith({ GET: getFor(detail()), POST } as unknown as ApiClient, <CleanPage cleanId="c1" />);
    expect(await screen.findByText('You earn')).toBeInTheDocument();
    // Before the start: the five steps ahead, and no progress yet.
    const ahead = screen.getByRole('region', { name: 'How the clean goes' });
    expect(
      within(ahead)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      'Step 1Before photosEvery room as you find it',
      'Step 2Any damage?Anything broken or missing',
      'Step 3Stock countHow much of each supply is left',
      'Step 4After photosEvery room, clean and ready',
      'Step 5Clean finishedTruHost and the owner are told',
    ]);
    expect(screen.queryByRole('img', { name: /steps done/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Start the clean/ }));
    expect(POST).toHaveBeenCalledWith('/v1/cleans/{id}/start', { params: { path: { id: 'c1' } } });

    expect(await screen.findByText('Step 1 of 5')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '0 of 5 steps done' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'How the clean goes' })).not.toBeInTheDocument();
    const before = step(1, 'Before photos');
    expect(before).toHaveAttribute('aria-current', 'step');
    expect(within(before).getAllByText('Take photo')).toHaveLength(2);
    expect(within(before).getByLabelText('Take photo (before, Bedroom)')).toHaveAttribute('capture', 'environment');
    expect(within(before).getByText(/TruHost and the owner can see these/)).toBeInTheDocument();
    expect(step(4, 'After photos')).toHaveTextContent('Opens after “Stock count”');
    expect(screen.queryByLabelText(/Take photo \(after/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Clean finished/ })).not.toBeInTheDocument();
  });

  it('pins the notes beside the clean, and counts the steps done in the hero', async () => {
    renderWith(
      {
        GET: getFor(working('STOCK_COUNT', { notes: 'Extra towels are in the hall closet.' })),
      } as unknown as ApiClient,
      <CleanPage cleanId="c1" />,
    );
    const notes = await screen.findByRole('region', { name: 'Notes for this clean' });
    expect(notes).toHaveTextContent('Extra towels are in the hall closet.');
    expect(screen.getByRole('img', { name: '2 of 5 steps done' })).toBeInTheDocument();
    // Each room says whether it has its before and after photos.
    const rooms = screen.getByRole('region', { name: 'Rooms', hidden: true });
    expect(rooms).toHaveTextContent('0 of 2 done');
    expect(rooms).toHaveTextContent('BedroomBefore takenAfter not taken yet');
  });

  it('offers an open clean to book from its page', async () => {
    const open = detail({ assignedCleaner: null, can: { ...CAN_NONE, book: true } });
    const POST = vi.fn(() => ok(detail({ can: CAN_NONE })));
    renderWith({ GET: getFor(open), POST } as unknown as ApiClient, <CleanPage cleanId="c1" />);
    expect(await screen.findByText('This clean is open.')).toBeInTheDocument();
    expect(screen.queryByText('No one is assigned to this clean yet.')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Book this clean' }));
    expect(POST).toHaveBeenCalledWith('/v1/cleans/{id}/book', { params: { path: { id: 'c1' } } });
  });

  it('says on which day a future clean can start', async () => {
    const later = addDays(today, 2);
    renderWith(
      { GET: vi.fn(() => ok(detail({ scheduledDate: later, can: CAN_NONE }))) } as unknown as ApiClient,
      <CleanPage cleanId="c1" />,
    );
    expect(await screen.findByText(/You can start this clean on/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Start the clean/ })).not.toBeInTheDocument();
  });

  it('asks about damage: no moves on, yes asks for a report linked to the clean', async () => {
    const POST = vi
      .fn()
      .mockImplementationOnce(() => ok(working('STOCK_COUNT')))
      .mockImplementationOnce(() =>
        ok(
          working('DAMAGE', {
            checklist: checklist({ current: 'DAMAGE', damage: { found: true, reports: [], done: false } }),
          }),
        ),
      );
    renderWith({ GET: getFor(working('DAMAGE')), POST } as unknown as ApiClient, <CleanPage cleanId="c1" />);
    const damage = await screen.findByRole('radiogroup', { name: 'Any damage?' });
    await userEvent.click(within(damage).getByRole('radio', { name: 'No damage' }));
    expect(POST).toHaveBeenCalledWith('/v1/cleans/{id}/damage-check', {
      params: { path: { id: 'c1' } },
      body: { found: false },
    });
    expect(await screen.findByText('Step 3 of 5')).toBeInTheDocument();
    // Reopen the done step and change the answer.
    await userEvent.click(within(step(2, 'Any damage\\?')).getByRole('button'));
    await userEvent.click(screen.getByRole('radio', { name: 'Yes, there’s damage' }));
    expect(POST).toHaveBeenLastCalledWith('/v1/cleans/{id}/damage-check', {
      params: { path: { id: 'c1' } },
      body: { found: true },
    });
    expect(await screen.findByRole('dialog', { name: 'Report damage' })).toBeInTheDocument();
  });

  it('takes a level for every supply, then lists what needs restocking', async () => {
    const GET = vi.fn((path: string) =>
      path === '/v1/properties/{id}/supplies'
        ? ok({ items: [supply('s1', 'Toilet paper'), supply('s2', 'Coffee pods')] })
        : path === '/v1/cleans/{id}'
          ? ok(working('STOCK_COUNT'))
          : ok({ items: [] }),
    );
    const counted = working('AFTER_PHOTOS', {
      checklist: checklist({
        current: 'AFTER_PHOTOS',
        beforePhotos: { done: true },
        damage: { found: false, reports: [], done: true },
        stockCount: {
          items: 2,
          counted: 2,
          done: true,
          restock: [{ id: 's2', name: 'Coffee pods', levelPct: 0, state: 'OUT' }],
        },
      }),
    });
    const POST = vi.fn(() => ok(counted));
    renderWith({ GET, POST } as unknown as ApiClient, <CleanPage cleanId="c1" />);
    const save = await screen.findByRole('button', { name: 'Save the stock count' });
    await userEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Toilet paper level' })).getByRole('radio', { name: 'Half' }),
    );
    expect(save).toBeDisabled();
    await userEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Coffee pods level' })).getByRole('radio', { name: 'Empty' }),
    );
    await userEvent.click(save);
    expect(POST).toHaveBeenCalledWith('/v1/cleans/{id}/stock-count', {
      params: { path: { id: 'c1' } },
      body: {
        readings: [
          { supplyItemId: 's1', levelPct: 50 },
          { supplyItemId: 's2', levelPct: 0 },
        ],
      },
    });
    expect(await screen.findByText('Step 4 of 5')).toBeInTheDocument();
    expect(step(3, 'Stock count')).toHaveTextContent('Counted · 1 to restock');
    expect(within(step(4, 'After photos')).getByLabelText('Take photo (after, Bathroom)')).toBeInTheDocument();
  });

  it('finishes once every step is done, then shows what was done', async () => {
    const ready = working('FINISH');
    const POST = vi
      .fn()
      .mockImplementationOnce(() =>
        fail(422, {
          code: 'CLEAN_CHECKLIST_INCOMPLETE',
          title: 'Unprocessable',
          detail: 'Finish “Stock count” first.',
          step: 'FINISH',
          waitingOn: 'STOCK_COUNT',
        }),
      )
      .mockImplementationOnce(() =>
        ok({ ...ready, status: 'COMPLETE', checklist: { ...ready.checklist, current: null }, can: CAN_NONE }),
      );
    renderWith({ GET: getFor(ready), POST } as unknown as ApiClient, <CleanPage cleanId="c1" />);
    await userEvent.click(await screen.findByRole('button', { name: /Clean finished/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Finish “Stock count” first.');
    await userEvent.click(screen.getByRole('button', { name: /Clean finished/ }));
    expect(await screen.findByText('Clean finished. Nice work.')).toBeInTheDocument();
    expect(screen.getByText(/have been told Cedar Cabin is ready for guests/)).toBeInTheDocument();
    const done = screen.getByRole('region', { name: 'What was done' });
    expect(within(done).getByRole('link', { name: 'Bedroom, before photo (opens full size)' })).toBeInTheDocument();
    expect(within(done).getByRole('link', { name: 'Bedroom, after photo (opens full size)' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Clean finished/ })).not.toBeInTheDocument();
  });
});
