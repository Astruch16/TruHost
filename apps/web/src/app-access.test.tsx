import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import type { ApiClient } from '@truhost/api-client';
import type { Me } from '@truhost/shared';
import { NotAvailable } from './components/shell/not-available';
import { ApiContext } from './lib/api-context';
import { routeTree } from './routeTree.gen';

// Signed in, as far as the app can tell. Who the user is comes from our API (GET /v1/me below), as in the app.
vi.mock('@clerk/react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true }),
  useClerk: () => ({ signOut: vi.fn() }),
  useUser: () => ({ isLoaded: true, user: null }),
  useSession: () => ({ session: null }),
  useReverification: (fn: unknown) => fn,
  useSignIn: () => ({ signIn: {} }),
  SignUp: () => null,
}));

const CEDAR = 'p-cedar';
const SEASIDE = 'p-seaside';

function person(memberships: Me['memberships'], staffRole: Me['staffRole'] = null): Me {
  return {
    id: 'u1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'Person',
    phone: null,
    staffRole,
    status: 'ACTIVE',
    guide: 'SAGE',
    avatar: null,
    weekStartsOn: 0,
    motion: 'SYSTEM',
    memberships,
  };
}
const owner = person([
  { id: 'm1', role: 'OWNER', property: { id: CEDAR, name: 'Cedar Cabin' } },
  { id: 'm2', role: 'CLEANER', property: { id: SEASIDE, name: 'Seaside Loft' } },
]);
const cleaner = person([{ id: 'm3', role: 'CLEANER', property: { id: CEDAR, name: 'Cedar Cabin' } }]);

const propertyData = (id: string) => ({
  id,
  name: id === CEDAR ? 'Cedar Cabin' : 'Seaside Loft',
  addressLine1: '45 Alpine Way',
  addressLine2: null,
  city: 'Whistler',
  province: 'BC',
  postalCode: 'V8E 0A1',
  checkInTime: '16:00',
  checkOutTime: '11:00',
  coverPhoto: null,
});

const SUPPLIES = {
  items: [
    {
      id: 's1',
      propertyId: CEDAR,
      name: 'Coffee pods',
      category: 'KITCHEN',
      thresholdPct: 25,
      position: 0,
      levelPct: 25,
      state: 'LOW',
      lastCheckedAt: '2026-10-12T18:00:00.000Z',
      archivedAt: null,
    },
  ],
};

const NOTIFICATIONS = {
  unread: 1,
  items: [
    {
      id: 'n1',
      kind: 'SUPPLY_LOW',
      title: 'Coffee pods is running low',
      body: 'Cedar Cabin · 25% left (restocked at 25%)',
      property: { id: CEDAR, name: 'Cedar Cabin' },
      entityType: 'SupplyItem',
      entityId: 's1',
      readAt: null,
      createdAt: '2026-10-12T18:00:00.000Z',
    },
  ],
};

const SUMMARY = {
  propertyId: CEDAR,
  month: '2026-10',
  daysInMonth: 31,
  nightsBooked: 12,
  ownerStayNights: 0,
  blockNights: 0,
  availableNights: 31,
  occupancyBps: 3871,
  stays: 3,
  grossCents: 240_000,
  plan: null,
  managementFeeBps: null,
  managementFeeCents: 0,
  ownerExpensesCents: 6_420,
  netCents: 233_580,
  avgNightlyEarningsCents: 20_000,
  incompleteBookings: 0,
  expensesMissingReceipt: 0,
};

/** A fake API that answers as the given user and records every path asked for. */
/** GET /v1/me fails with these (in order) before answering normally. */
type MeFailure = { status: number; code: string };

function fakeApi(start: Me, meFailures: MeFailure[] = []) {
  let me = start;
  const failures = [...meFailures];
  const created = new Map<string, ReturnType<typeof propertyData>>();
  const paths: string[] = [];
  const posts: { path: string; body: unknown }[] = [];
  const GET = vi.fn(async (path: string, init?: { params?: { path?: { id?: string } } }) => {
    paths.push(path);
    const failure = path === '/v1/me' ? failures.shift() : undefined;
    if (failure) {
      return { error: { ...failure, title: 'Error' }, response: new Response(null, { status: failure.status }) };
    }
    const id = init?.params?.path?.id ?? '';
    const data =
      path === '/v1/me'
        ? me
        : path === '/v1/properties'
          ? { items: me.memberships.map((m) => created.get(m.property.id) ?? propertyData(m.property.id)) }
          : path === '/v1/properties/{id}'
            ? (created.get(id) ?? propertyData(id))
            : path === '/v1/properties/{id}/rooms'
              ? {
                  items: [
                    {
                      id: 'r1',
                      type: 'KITCHEN',
                      label: null,
                      number: 1,
                      displayName: 'Kitchen',
                      position: 0,
                      archivedAt: null,
                    },
                  ],
                }
              : path === '/v1/properties/{id}/supplies'
                ? SUPPLIES
                : path === '/v1/me/notifications'
                  ? NOTIFICATIONS
                  : path === '/v1/me/onboarding'
                    ? { tours: [] } // tours done: no welcome over the pages under test (onboarding.test.tsx has it)
                    : path === '/v1/properties/{id}/summary'
                      ? SUMMARY
                      : path === '/v1/properties/{id}/plan'
                        ? { current: null, history: [] }
                        : { items: [] };
    return { data, response: new Response(null, { status: 200 }) };
  });
  // Adding a property: answers like the API, and makes the caller its owner when asked to.
  const POST = vi.fn(async (path: string, init: { body: { name: string; ownedByMe?: boolean } }) => {
    posts.push({ path, body: init.body });
    if (path === '/v1/properties/{id}/supply-statuses') {
      return { data: SUPPLIES, response: new Response(null, { status: 201 }) };
    }
    if (path === '/v1/me/notifications/read') {
      return { data: { ...NOTIFICATIONS, unread: 0 }, response: new Response(null, { status: 200 }) };
    }
    const property = { ...propertyData('p-new'), name: init.body.name };
    created.set('p-new', property);
    if (init.body.ownedByMe) {
      me = {
        ...me,
        memberships: [
          ...me.memberships,
          { id: 'm-new', role: 'OWNER', property: { id: 'p-new', name: property.name } },
        ],
      };
    }
    return { data: property, response: new Response(null, { status: 201 }) };
  });
  return { api: { GET, POST } as unknown as ApiClient, paths, posts };
}

function renderAt(url: string, me: Me, meFailures: MeFailure[] = []) {
  const { api, paths, posts } = fakeApi(me, meFailures);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [url] }),
    context: { queryClient },
    defaultNotFoundComponent: () => <NotAvailable />,
  });
  render(
    <ApiContext.Provider value={api}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ApiContext.Provider>,
  );
  return { router, paths, posts };
}

const FINANCIAL = [
  '/v1/properties/{id}/summary',
  '/v1/properties/{id}/plan',
  '/v1/properties/{id}/bookings',
  '/v1/properties/{id}/expenses',
  '/v1/dashboard',
];

beforeEach(() => {
  // The shell reads the stored property scope.
  localStorage.clear();
});
afterEach(() => vi.clearAllMocks());

describe('cleaners', () => {
  it('get their own property page: name, address and rooms, and nothing financial is rendered or fetched', async () => {
    const { paths } = renderAt(`/cleaner/properties/${CEDAR}`, cleaner);
    // The first find waits for the whole portal (shell, then the lazy route): slower on CI runners than locally.
    expect(await screen.findByRole('heading', { name: 'Cedar Cabin' }, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText(/45 Alpine Way/)).toBeInTheDocument();
    expect(await screen.findByText('Kitchen')).toBeInTheDocument();
    for (const title of ['Your month', 'Management fee', 'Stays', 'Expenses']) {
      expect(screen.queryByRole('heading', { name: title })).not.toBeInTheDocument();
    }
    expect(paths.filter((p) => FINANCIAL.includes(p))).toEqual([]);
  });

  it('mark how full each supply is with one tap', async () => {
    const { posts } = renderAt(`/cleaner/properties/${CEDAR}`, cleaner);
    expect(await screen.findByRole('heading', { name: /Supplies/ })).toBeInTheDocument();
    expect(await screen.findByRole('meter', { name: 'Coffee pods level' })).toHaveAttribute('aria-valuenow', '25');
    expect(screen.getByText(/TruHost and the owner have been told/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Coffee pods: A quarter' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Coffee pods: Empty' }));
    await waitFor(() =>
      expect(posts).toContainEqual({
        path: '/v1/properties/{id}/supply-statuses',
        body: { readings: [{ supplyItemId: 's1', levelPct: 0, note: null }] },
      }),
    );
    // Cleaners can't manage the list or see who reported what.
    expect(screen.queryByRole('button', { name: 'Add a supply' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Coffee pods: history' })).not.toBeInTheDocument();
  });

  it('can report damage at a property they clean', async () => {
    renderAt(`/cleaner/properties/${CEDAR}`, cleaner);
    expect(await screen.findByRole('heading', { name: 'Damage reports' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Report damage' })).toBeInTheDocument();
  });

  it('opening the owner page for a property they clean takes them to the cleaner page instead', async () => {
    const { router, paths } = renderAt(`/properties/${CEDAR}`, cleaner);
    expect(await screen.findByText('You clean here')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/cleaner/properties/${CEDAR}`);
    expect(paths.filter((p) => FINANCIAL.includes(p))).toEqual([]);
  });

  it('see "not available" for a property that isn’t theirs', async () => {
    const { paths } = renderAt(`/cleaner/properties/${SEASIDE}`, cleaner);
    expect(await screen.findByRole('heading', { name: 'This page isn’t available' })).toBeInTheDocument();
    expect(paths).not.toContain('/v1/properties/{id}');
  });

  it('picking a property in the top-bar switcher opens its cleaner page', async () => {
    const { router } = renderAt('/properties', cleaner);
    await userEvent.click(await screen.findByRole('button', { name: /Switch property|Choose a property/ }));
    const list = await screen.findByRole('list', { name: 'Properties' });
    await userEvent.click(within(list).getByRole('button', { name: /Cedar Cabin/ }));
    expect(await screen.findByText('You clean here')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/cleaner/properties/${CEDAR}`);
  });

  it('get the cleaner page from the property list', async () => {
    renderAt('/properties', cleaner);
    expect(await screen.findByRole('link', { name: /Cedar Cabin/ })).toHaveAttribute(
      'href',
      `/cleaner/properties/${CEDAR}`,
    );
  });
});

describe('owners', () => {
  it('get the owner page with its financial sections', async () => {
    renderAt(`/properties/${CEDAR}`, owner);
    expect(await screen.findByRole('heading', { name: 'Your month' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Management fee' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Stays' })).toBeInTheDocument();
    expect((await screen.findAllByText('Net to you')).length).toBeGreaterThan(0);
  });

  it('see supply levels and what needs restocking, read-only', async () => {
    renderAt(`/properties/${CEDAR}`, owner);
    expect(await screen.findByRole('meter', { name: 'Coffee pods level' })).toBeInTheDocument();
    expect(screen.getByText('1 to restock')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Coffee pods: (Full|Empty)/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Manage supplies' })).not.toBeInTheDocument();
  });

  it('see damage reports, but don’t report damage themselves', async () => {
    renderAt(`/properties/${CEDAR}`, owner);
    expect(await screen.findByRole('heading', { name: 'Damage reports' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Report damage' })).not.toBeInTheDocument();
  });

  it('can’t edit rooms unless they’re TruHost admins', async () => {
    renderAt(`/properties/${CEDAR}`, owner);
    expect(await screen.findByRole('heading', { name: 'Rooms' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit rooms' })).not.toBeInTheDocument();
  });

  it('who are admins edit the property’s rooms from its page (the same rooms as everywhere)', async () => {
    const user = userEvent.setup();
    const adminOwner = person([{ id: 'm1', role: 'OWNER', property: { id: CEDAR, name: 'Cedar Cabin' } }], 'ADMIN');
    const { paths } = renderAt(`/properties/${CEDAR}`, adminOwner);
    await user.click(await screen.findByRole('button', { name: 'Edit rooms' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit rooms' });
    expect(await within(dialog).findByRole('list', { name: 'Rooms in walkthrough order' })).toHaveTextContent(
      'Kitchen',
    );
    expect(within(dialog).getByRole('button', { name: 'Reorder Kitchen' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Add a room' })).toBeInTheDocument();
    expect(paths.filter((p) => p === '/v1/properties/{id}/rooms').length).toBeGreaterThan(0);
  });

  it('who also clean another property get the cleaner page for that one', async () => {
    const { router } = renderAt(`/properties/${SEASIDE}`, owner);
    expect(await screen.findByText('You clean here')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/cleaner/properties/${SEASIDE}`);
    expect(screen.queryByRole('heading', { name: 'Your month' })).not.toBeInTheDocument();
  });
});

describe('admin pages by URL', () => {
  const ADMIN_PAGES = [
    '/admin',
    '/admin/calendar',
    '/admin/properties',
    `/admin/properties/${CEDAR}`,
    '/admin/bookings',
    '/admin/expenses',
    '/admin/team',
    '/admin/plans',
    '/admin/supplies',
    '/admin/damage',
  ];

  it.each(
    ADMIN_PAGES.flatMap((url) => [
      ['owner', url],
      ['cleaner', url],
    ]),
  )('%s opening %s sees "not available" and no admin data is fetched', async (who, url) => {
    const { paths } = renderAt(url, who === 'owner' ? owner : cleaner);
    expect(await screen.findByRole('heading', { name: 'This page isn’t available' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to your home page' })).toHaveAttribute('href', '/');
    const adminOnly = ['/v1/dashboard', '/v1/users', '/v1/invites', '/v1/plans', '/v1/bookings', '/v1/expenses'];
    expect(paths.filter((p) => adminOnly.includes(p))).toEqual([]);
  });

  it('an address that doesn’t exist shows the same page inside the portal', async () => {
    renderAt('/admin/nothing-here', owner);
    expect(await screen.findByRole('heading', { name: 'This page isn’t available' })).toBeInTheDocument();
  });

  it('cleaner pages aren’t available to owners who clean nothing', async () => {
    renderAt(
      `/cleaner/properties/${CEDAR}`,
      person([{ id: 'm9', role: 'OWNER', property: { id: CEDAR, name: 'Cedar Cabin' } }]),
    );
    expect(await screen.findByRole('heading', { name: 'This page isn’t available' })).toBeInTheDocument();
  });
});

describe('adding your own property (My properties)', () => {
  const admin = person([{ id: 'm1', role: 'OWNER', property: { id: CEDAR, name: 'Cedar Cabin' } }], 'ADMIN');

  it('lets an admin add a property they own, then opens it', async () => {
    const user = userEvent.setup();
    const { router, posts } = renderAt('/properties', admin);
    await user.click(await screen.findByRole('button', { name: 'Add property' }));
    const dialog = await screen.findByRole('dialog', { name: 'New property' });
    expect(dialog).toHaveTextContent('you’ll be its owner');
    await user.type(within(dialog).getByRole('textbox', { name: /Name/ }), 'Lake House');
    await user.type(within(dialog).getByRole('textbox', { name: /Street address/ }), '9 Shore Rd');
    await user.type(within(dialog).getByRole('textbox', { name: /City/ }), 'Harrison');
    await user.type(within(dialog).getByRole('textbox', { name: /Postal code/ }), 'V0M 1K0');
    await user.click(within(dialog).getByRole('button', { name: 'Create property' }));
    expect(posts).toEqual([
      { path: '/v1/properties', body: expect.objectContaining({ name: 'Lake House', ownedByMe: true }) },
    ]);
    expect(await screen.findByRole('heading', { name: 'Lake House' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/properties/p-new');
  });

  it('lets an admin edit their properties from the cards; owners can’t', async () => {
    renderAt('/properties', admin);
    expect(await screen.findByRole('button', { name: 'Edit Cedar Cabin' })).toBeInTheDocument();
    cleanup();
    renderAt('/properties', owner);
    await screen.findByRole('link', { name: /Cedar Cabin/ });
    expect(screen.queryByRole('button', { name: /^Edit / })).not.toBeInTheDocument();
  });

  it('offers it in the empty state to an admin with no properties of their own', async () => {
    renderAt('/properties', person([], 'ADMIN'));
    expect(await screen.findByText('None of your own properties yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add property' })).toBeInTheDocument();
  });

  it('isn’t offered to owners or cleaners (only TruHost adds properties)', async () => {
    for (const me of [owner, cleaner, person([])]) {
      renderAt('/properties', me);
      await screen.findByRole('heading', { name: 'My properties' });
      await waitFor(() => expect(screen.queryByRole('status', { name: /Loading/ })).not.toBeInTheDocument());
      expect(screen.queryByRole('button', { name: 'Add property' })).not.toBeInTheDocument();
      cleanup();
    }
  });
});

describe('top bar', () => {
  it('has a notifications bell for admins and owners, not for cleaners', async () => {
    for (const me of [owner, person([], 'ADMIN')]) {
      renderAt('/account/preferences', me);
      expect(await screen.findByRole('button', { name: 'Notifications, 1 unread' })).toBeInTheDocument();
      cleanup();
    }
    const { paths } = renderAt('/account/preferences', cleaner);
    await screen.findByRole('button', { name: /Account menu/ });
    expect(screen.queryByRole('button', { name: /Notifications/ })).not.toBeInTheDocument();
    expect(paths).not.toContain('/v1/me/notifications');
  });

  it('opening a notification marks it read and goes to the owner’s portal (supplies: Home)', async () => {
    const { router, posts } = renderAt('/account/preferences', owner);
    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    await userEvent.click(await screen.findByRole('button', { name: /Coffee pods is running low/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/owner'));
    expect(posts).toContainEqual({ path: '/v1/me/notifications/read', body: { ids: ['n1'] } });
  });
});

describe('when the account can’t load', () => {
  // These screens use the sign-in background, which follows media queries and its own size (jsdom has neither).
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.stubGlobal(
      'matchMedia',
      (query: string): MediaQueryList =>
        ({
          matches: false,
          media: query,
          onchange: null,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          addListener: () => undefined,
          removeListener: () => undefined,
          dispatchEvent: () => false,
        }) as MediaQueryList,
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('a sign-in service blip offers Try again, and trying again gets in', async () => {
    renderAt('/properties', owner, [{ status: 503, code: 'AUTH_UNAVAILABLE' }]);
    expect(await screen.findByRole('heading', { name: 'We couldn’t check your sign-in' })).toBeInTheDocument();
    expect(screen.getByText(/Your account is fine/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'My properties' })).toBeInTheDocument();
  });

  it('an ended session asks to sign in again, with no retry', async () => {
    renderAt('/properties', owner, [{ status: 401, code: 'UNAUTHORIZED' }]);
    expect(await screen.findByRole('heading', { name: 'Your session has ended' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in again' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('someone who was never invited is told so, and can only sign out', async () => {
    renderAt('/properties', owner, [{ status: 403, code: 'NOT_INVITED' }]);
    expect(await screen.findByRole('heading', { name: 'No access yet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });
});
