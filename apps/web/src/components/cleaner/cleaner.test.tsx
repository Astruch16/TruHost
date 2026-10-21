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
import type { Clean, CleanSummary } from '@truhost/shared';
import type { ReactNode } from 'react';
import { ApiContext } from '../../lib/api-context';
import { dayLabel } from '../../lib/dashboard-format';
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

const detail = (over: Partial<Clean> = {}): Clean => ({
  ...summary(),
  rooms: [
    { id: 'r1', displayName: 'Bedroom', before: [], after: [] },
    { id: 'r2', displayName: 'Bathroom', before: [], after: [] },
  ],
  today,
  can: { start: true, addPhotos: false, complete: false },
  ...over,
});

const ok = (data: unknown, status = 200) => Promise.resolve({ data, response: new Response(null, { status }) });
/** GET for the walkthrough: the clean, and an empty supplies list for its supplies check. */
const getFor = (clean: Clean) =>
  vi.fn((path: string) => (path === '/v1/properties/{id}/supplies' ? ok({ items: [] }) : ok(clean)));
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

describe('cleaner schedule', () => {
  it('shows today’s cleans with the window, then what’s coming up and what was done', async () => {
    const items = [
      summary(),
      summary({
        id: 'c2',
        scheduledDate: addDays(today, 3),
        property: { id: 'p2', name: 'Seaside Loft', city: 'Tofino' },
      }),
      summary({ id: 'c3', scheduledDate: addDays(today, -2), status: 'COMPLETE', completedAt: '2026-11-18T22:00:00Z' }),
    ];
    const GET = vi.fn(() => ok({ items }));
    renderWith({ GET } as unknown as ApiClient, <CleanerSchedulePage />);
    const todayCard = (await screen.findByRole('link', { name: 'Cedar Cabin' })).closest('li')!;
    expect(todayCard).toHaveTextContent('Free from 11 AM');
    expect(todayCard).toHaveTextContent('Ready by 4 PM');
    expect(todayCard).toHaveTextContent('Start the clean');
    expect(within(screen.getByRole('region', { name: 'Coming up' })).getByText('Seaside Loft')).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Recently done' })).getByText(/2 rooms photographed/),
    ).toBeInTheDocument();
    expect(GET).toHaveBeenCalledWith('/v1/cleans', {
      params: { query: { assignee: 'me', from: addDays(today, -14), to: addDays(today, 90) } },
    });
  });

  it('groups what’s coming up by week, sorts it, narrows it to a property, and to a day picked on the calendar', async () => {
    const cedar = { id: 'p1', name: 'Cedar Cabin', city: 'Whistler' };
    const seaside = { id: 'p2', name: 'Seaside Loft', city: 'Tofino' };
    const items = [
      summary({ id: 'a', scheduledDate: addDays(today, 1), property: cedar }),
      summary({ id: 'b', scheduledDate: addDays(today, 8), property: seaside }),
      summary({ id: 'c', scheduledDate: addDays(today, 40), property: cedar }),
    ];
    renderWith({ GET: vi.fn(() => ok({ items })) } as unknown as ApiClient, <CleanerSchedulePage />);
    const upcoming = await screen.findByRole('region', { name: 'Coming up' });
    expect(within(upcoming).getAllByRole('region').length).toBeGreaterThanOrEqual(2); // week groups
    const order = () =>
      within(upcoming)
        .getAllByRole('link')
        .map((l) => l.getAttribute('href'));
    expect(order()).toEqual(['/cleaner/cleans/a', '/cleaner/cleans/b', '/cleaner/cleans/c']);

    await userEvent.click(within(upcoming).getByRole('button', { name: 'Latest first' }));
    expect(order()).toEqual(['/cleaner/cleans/c', '/cleaner/cleans/b', '/cleaner/cleans/a']);

    await userEvent.click(within(upcoming).getByRole('button', { name: /Seaside Loft/ }));
    expect(order()).toEqual(['/cleaner/cleans/b']);

    // Picking a day on the calendar shows just that day's cleans.
    const tomorrow = addDays(today, 1);
    if (tomorrow.slice(0, 7) === today.slice(0, 7)) {
      await userEvent.click(screen.getByRole('button', { name: /1 clean \(Cedar Cabin\)/ }));
      const day = screen.getByRole('region', { name: dayLabel(tomorrow) });
      expect(
        within(day)
          .getAllByRole('link')
          .map((l) => l.getAttribute('href')),
      ).toEqual(['/cleaner/cleans/a']);
      await userEvent.click(screen.getByRole('button', { name: 'Show everything coming up' }));
      expect(screen.getByRole('region', { name: 'Coming up' })).toBeInTheDocument();
    }
  });

  it('says when there’s nothing today, and when the next clean is', async () => {
    const items = [summary({ id: 'c2', scheduledDate: addDays(today, 2) })];
    renderWith({ GET: vi.fn(() => ok({ items })) } as unknown as ApiClient, <CleanerSchedulePage />);
    expect(await screen.findByRole('heading', { name: 'Nothing to clean today' })).toBeInTheDocument();
    const hero = screen.getByRole('region', { name: 'Nothing to clean today' });
    expect(hero).toHaveTextContent(/Next up: Cedar Cabin/);
    expect(within(hero).getByRole('link', { name: /Open the next clean/ })).toHaveAttribute(
      'href',
      '/cleaner/cleans/c2',
    );
  });
});

describe('a clean’s walkthrough', () => {
  it('starts on its day, then shows each room’s before and after camera buttons', async () => {
    const started = detail({ status: 'IN_PROGRESS', can: { start: false, addPhotos: true, complete: true } });
    const POST = vi.fn(() => ok(started));
    renderWith({ GET: getFor(detail()), POST } as unknown as ApiClient, <CleanPage cleanId="c1" />);
    expect(await screen.findByText('You earn')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Start the clean/ }));
    expect(POST).toHaveBeenCalledWith('/v1/cleans/{id}/start', { params: { path: { id: 'c1' } } });
    const bedroom = (await screen.findByRole('heading', { name: 'Bedroom' })).closest('li')!;
    expect(within(bedroom).getByText('Take before photo')).toBeInTheDocument();
    expect(within(bedroom).getByText('Take after photo')).toBeInTheDocument();
    expect(within(bedroom).getByLabelText('Take before photo')).toHaveAttribute('capture', 'environment');
    expect(screen.getByText('0 of 2 done')).toBeInTheDocument();
  });

  it('says on which day a future clean can start', async () => {
    const later = addDays(today, 2);
    renderWith(
      {
        GET: vi.fn(() =>
          ok(detail({ scheduledDate: later, can: { start: false, addPhotos: false, complete: false } })),
        ),
      } as unknown as ApiClient,
      <CleanPage cleanId="c1" />,
    );
    expect(await screen.findByText(/You can start this clean on/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Start the clean/ })).not.toBeInTheDocument();
  });

  it('lists the rooms still missing photos, and celebrates once it’s complete', async () => {
    const inProgress = detail({
      status: 'IN_PROGRESS',
      can: { start: false, addPhotos: true, complete: true },
      progress: { rooms: 2, done: 1 },
      rooms: [
        { id: 'r1', displayName: 'Bedroom', before: [photo('r1', 'BEFORE')], after: [photo('r1', 'AFTER')] },
        { id: 'r2', displayName: 'Bathroom', before: [photo('r2', 'BEFORE')], after: [] },
      ],
    });
    const POST = vi
      .fn()
      .mockImplementationOnce(() =>
        fail(422, {
          code: 'CLEAN_MISSING_PHOTOS',
          title: 'Unprocessable',
          detail: 'Every room needs a before and an after photo.',
          missing: [{ roomId: 'r2', displayName: 'Bathroom', phases: ['AFTER'] }],
        }),
      )
      .mockImplementationOnce(() =>
        ok({
          ...inProgress,
          status: 'COMPLETE',
          progress: { rooms: 2, done: 2 },
          can: { start: false, addPhotos: false, complete: false },
        }),
      );
    renderWith({ GET: getFor(inProgress), POST } as unknown as ApiClient, <CleanPage cleanId="c1" />);
    await userEvent.click(await screen.findByRole('button', { name: /Complete the clean/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Bathroom: after');
    await userEvent.click(screen.getByRole('button', { name: /Complete the clean/ }));
    expect(await screen.findByText('Clean complete. Nice work.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Complete the clean/ })).not.toBeInTheDocument();
  });
});
