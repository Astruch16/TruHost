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
import type { TimeOffRequest } from '@truhost/shared';
import type { ReactNode } from 'react';
import { ApiContext } from '../../lib/api-context';
import { todayIso } from '../../lib/dates';
import { navItems } from '../../lib/nav';
import { AdminTimeOffPage } from './admin-time-off-page';
import { CleanerTimeOffPage } from './cleaner-time-off-page';

const ok = (data: unknown, status = 200) => Promise.resolve({ data, response: new Response(null, { status }) });

function renderWith(api: Partial<ApiClient>, ui: ReactNode) {
  const root = createRootRoute();
  const page = createRoute({ getParentRoute: () => root, path: '/', component: () => <>{ui}</> });
  const router = createRouter({ routeTree: root.addChildren([page]), history: createMemoryHistory() });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <ApiContext.Provider value={api as ApiClient}>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ApiContext.Provider>,
  );
}

const request = (over: Partial<TimeOffRequest> = {}): TimeOffRequest => ({
  id: 't1',
  cleaner: { id: 'u1', firstName: 'Casey', lastName: 'Clean' },
  startDate: '2026-12-21',
  endDate: '2026-12-24',
  days: 4,
  reason: 'HOLIDAY',
  note: 'Family trip',
  status: 'PENDING',
  decidedBy: null,
  decidedAt: null,
  decisionNote: null,
  cancelledAt: null,
  createdAt: '2026-11-20T19:00:00Z',
  conflicts: [{ cleanId: 'c1', date: '2026-12-22', property: { id: 'p1', name: 'Cedar Cabin' } }],
  can: { cancel: true, decide: false },
  ...over,
});

const listing = (items: TimeOffRequest[]) =>
  vi.fn((path: string) => (path === '/v1/time-off' ? ok({ items }) : ok({ items: [] })));

describe('a cleaner’s time off', () => {
  it('asks for days off, saying what for', async () => {
    const today = todayIso();
    const POST = vi.fn(() => ok(request({ startDate: today, endDate: today, days: 1 }), 201));
    renderWith({ GET: listing([]), POST } as unknown as ApiClient, <CleanerTimeOffPage />);
    expect(await screen.findByText('No time off asked for yet')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    expect(screen.getByText('Pick the first day')).toBeInTheDocument();
    expect(screen.getByText('Say what it’s for')).toBeInTheDocument();
    expect(POST).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'First day' }));
    await user.click(screen.getByRole('button', { name: /, today$/ }));
    await user.click(screen.getByRole('radio', { name: /Holiday/ }));
    await user.type(screen.getByLabelText(/Note for TruHost/), 'Family trip');
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    expect(POST).toHaveBeenCalledWith('/v1/time-off', {
      body: { startDate: today, endDate: today, reason: 'HOLIDAY', note: 'Family trip' },
    });
    expect(await screen.findByText('Request sent.')).toBeInTheDocument();
  });

  it('shows each request with the cleans it falls on, and lets its cleaner withdraw it', async () => {
    const POST = vi.fn(() => ok(request({ status: 'CANCELLED', can: { cancel: false, decide: false } })));
    renderWith({ GET: listing([request()]), POST } as unknown as ApiClient, <CleanerTimeOffPage />);
    const card = await screen.findByRole('listitem', { name: /Mon, Dec 21 – Thu, Dec 24, Waiting for TruHost/ });
    expect(card).toHaveTextContent('4 days · Holiday');
    expect(card).toHaveTextContent('“Family trip”');
    expect(card).toHaveTextContent('1 clean in these dates');
    expect(card).toHaveTextContent('Tue, Dec 22 · Cedar Cabin');
    const user = userEvent.setup();
    await user.click(within(card).getByRole('button', { name: 'Withdraw request' }));
    await user.click(within(card).getByRole('button', { name: 'Yes, cancel it' }));
    expect(POST).toHaveBeenCalledWith('/v1/time-off/{id}/cancel', { params: { path: { id: 't1' } } });
  });
});

describe('admins and time off', () => {
  it('lists what’s waiting, with the cleans to reassign, and approves with a note', async () => {
    const GET = listing([request({ can: { cancel: false, decide: true } })]);
    const POST = vi.fn(() => ok(request({ status: 'APPROVED' })));
    renderWith({ GET, POST } as unknown as ApiClient, <AdminTimeOffPage />);
    const card = await screen.findByRole('listitem', { name: /^Casey Clean: Mon, Dec 21/ });
    expect(GET).toHaveBeenCalledWith('/v1/time-off', { params: { query: { status: 'PENDING' } } });
    expect(screen.getByRole('button', { name: 'Waiting (1)' })).toHaveAttribute('aria-pressed', 'true');
    expect(card).toHaveTextContent('1 clean in these dates to reassign');
    const user = userEvent.setup();
    await user.type(within(card).getByLabelText(/Note for the cleaner/), 'Enjoy');
    await user.click(within(card).getByRole('button', { name: 'Approve' }));
    expect(POST).toHaveBeenCalledWith('/v1/time-off/{id}/decision', {
      params: { path: { id: 't1' } },
      body: { status: 'APPROVED', note: 'Enjoy' },
    });
  });

  it('puts Time off in the cleaner’s and the admin’s navigation, not an owner’s', () => {
    const labels = (me: Parameters<typeof navItems>[0]) => navItems(me).map((i) => i.label);
    expect(labels({ staffRole: null, memberships: [{ role: 'CLEANER' }] })).toContain('Time off');
    expect(labels({ staffRole: 'ADMIN', memberships: [] })).toContain('Time off');
    expect(labels({ staffRole: null, memberships: [{ role: 'OWNER' }] })).not.toContain('Time off');
  });
});
