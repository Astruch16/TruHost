import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
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

/** A fake API that answers as the given user and records every path asked for. */
function fakeApi(me: Me) {
  const paths: string[] = [];
  const GET = vi.fn(async (path: string, init?: { params?: { path?: { id?: string } } }) => {
    paths.push(path);
    const id = init?.params?.path?.id ?? '';
    const data =
      path === '/v1/me'
        ? me
        : path === '/v1/properties'
          ? { items: me.memberships.map((m) => propertyData(m.property.id)) }
          : path === '/v1/properties/{id}'
            ? propertyData(id)
            : path === '/v1/properties/{id}/rooms'
              ? { items: [{ id: 'r1', name: 'Kitchen', type: 'KITCHEN', sortOrder: 0, archivedAt: null }] }
              : { items: [] };
    return { data, response: new Response(null, { status: 200 }) };
  });
  return { api: { GET } as unknown as ApiClient, paths };
}

function renderAt(url: string, me: Me) {
  const { api, paths } = fakeApi(me);
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
  return { router, paths };
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
    expect(await screen.findByRole('heading', { name: 'Cedar Cabin' })).toBeInTheDocument();
    expect(screen.getByText(/45 Alpine Way/)).toBeInTheDocument();
    expect(await screen.findByText('Kitchen')).toBeInTheDocument();
    for (const title of ['Month at a glance', 'Plan', 'Bookings', 'Expenses']) {
      expect(screen.queryByRole('heading', { name: title })).not.toBeInTheDocument();
    }
    expect(paths.filter((p) => FINANCIAL.includes(p))).toEqual([]);
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
    expect(await screen.findByRole('heading', { name: 'Month at a glance' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Plan' })).toBeInTheDocument();
  });

  it('who also clean another property get the cleaner page for that one', async () => {
    const { router } = renderAt(`/properties/${SEASIDE}`, owner);
    expect(await screen.findByText('You clean here')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/cleaner/properties/${SEASIDE}`);
    expect(screen.queryByRole('heading', { name: 'Month at a glance' })).not.toBeInTheDocument();
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

describe('top bar', () => {
  it('has no notifications bell for any role until notifications exist', async () => {
    for (const me of [owner, cleaner, person([], 'ADMIN')]) {
      renderAt('/account/preferences', me);
      await screen.findByRole('button', { name: /Account menu/ });
      expect(screen.queryByRole('button', { name: /Notifications/ })).not.toBeInTheDocument();
      cleanup();
    }
  });
});
