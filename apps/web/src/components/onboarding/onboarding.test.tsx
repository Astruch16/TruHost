import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import type { ApiClient } from '@truhost/api-client';
import type { Me, Onboarding } from '@truhost/shared';
import { useState } from 'react';
import { ApiContext } from '../../lib/api-context';
import { OnboardingHost } from './onboarding-host';

const ME: Me = {
  id: 'u1',
  email: 'owner@example.test',
  firstName: 'Jordan',
  lastName: 'Lee',
  phone: null,
  staffRole: null,
  status: 'ACTIVE',
  guide: 'SAGE',
  avatar: null,
  weekStartsOn: 0,
  motion: 'SYSTEM',
  memberships: [{ id: 'm1', role: 'OWNER', property: { id: 'p1', name: 'Cedar Cabin' } }],
};

const fresh: Onboarding = { tours: [{ role: 'OWNER', status: 'NOT_STARTED', step: null, offer: true }] };

const ok = (data: unknown) => Promise.resolve({ data, response: new Response(null, { status: 200 }) });

/** The host over a few owner pages carrying the tour's anchors, against a fake API that records each move. */
function renderHost(onboarding: Onboarding) {
  const posts: { role: string; body: unknown }[] = [];
  const api = {
    GET: vi.fn(() => ok(onboarding)),
    POST: vi.fn((_path: string, init: { params: { path: { role: string } }; body: { action: string } }) => {
      posts.push({ role: init.params.path.role, body: init.body });
      return ok(onboarding);
    }),
    PATCH: vi.fn(() => ok(ME)),
  } as unknown as ApiClient;
  function Shell() {
    const [help, setHelp] = useState(false);
    return (
      <>
        <button type="button" data-tour="profile-menu" onClick={() => setHelp(true)}>
          Account menu
        </button>
        <OnboardingHost me={ME} helpOpen={help} onHelpOpenChange={setHelp} />
        <Outlet />
      </>
    );
  }
  const root = createRootRoute({ component: Shell });
  const page = (path: string, body: React.ReactNode) =>
    createRoute({ getParentRoute: () => root, path, component: () => <>{body}</> });
  const router = createRouter({
    routeTree: root.addChildren([
      // Home, without the cards that only show with data (the figures, Coming up, Good to know).
      page(
        '/owner',
        <>
          <section data-tour="owner-month">Your month</section>
          {['owner-this-month', 'owner-ytd', 'owner-net-by-month', 'owner-supplies', 'owner-contact'].map((a) => (
            <section key={a} data-tour={a} />
          ))}
        </>,
      ),
      page(
        '/owner/calendar',
        <>
          <section data-tour="owner-calendar">Calendar</section>
          <section data-tour="owner-glance" />
        </>,
      ),
      page('/owner/statements', <section data-tour="owner-statements">Statements</section>),
      page('/owner/damage', <section data-tour="owner-damage">Damage</section>),
      page('/owner/care', <section data-tour="owner-care">Care</section>),
    ]),
    history: createMemoryHistory({ initialEntries: ['/owner'] }),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <ApiContext.Provider value={api}>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ApiContext.Provider>,
  );
  return { posts, router };
}

describe('onboarding', () => {
  beforeEach(() => {
    // jsdom has no layout: every element counts as on screen, and the browser APIs the tour uses do nothing.
    vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    window.scrollTo = () => undefined;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('welcomes a new owner with their guide and what the tour covers, then walks through it page by page', async () => {
    const { posts } = renderHost(fresh);
    const welcome = await screen.findByRole('dialog', { name: 'Welcome to TruHost' });
    expect(within(welcome).getByText('Hi Jordan, I’m Sage.')).toBeInTheDocument();
    expect(within(welcome).getByText(/show you around your owner portal/)).toBeInTheDocument();
    expect(within(welcome).getByText('Statements')).toBeInTheDocument();

    await userEvent.click(within(welcome).getByRole('button', { name: 'Start the tour' }));
    const step = await screen.findByRole('dialog', { name: 'Your month at a glance' });
    expect(within(step).getByText('Sage · Step 1 of 15')).toBeInTheDocument();
    expect(posts).toEqual([{ role: 'OWNER', body: { action: 'START', step: 0 } }]);

    // The figures card isn't on this page, so it is passed over: next is the section below.
    await userEvent.click(within(step).getByRole('button', { name: /Next/ }));
    expect(await screen.findByRole('dialog', { name: 'This month so far' })).toBeInTheDocument();
    expect(posts.at(-1)).toEqual({ role: 'OWNER', body: { action: 'STEP', step: 2 } });

    await userEvent.click(screen.getByRole('button', { name: /Back/ }));
    expect(await screen.findByRole('dialog', { name: 'Your month at a glance' })).toBeInTheDocument();
  }, 20_000);

  it('records a skip from the welcome, and from the tour with Escape', async () => {
    const { posts } = renderHost(fresh);
    await userEvent.click(await screen.findByRole('button', { name: 'Skip for now' }));
    expect(posts).toEqual([{ role: 'OWNER', body: { action: 'SKIP' } }]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Help replays it; Escape skips it where it stopped.
    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    const help = await screen.findByRole('dialog', { name: 'Help' });
    expect(within(help).getByText('How do I…')).toBeInTheDocument();
    await userEvent.click(within(help).getByRole('button', { name: /Replay/ }));
    expect(await screen.findByRole('dialog', { name: 'Your month at a glance' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(posts.at(-1)).toEqual({ role: 'OWNER', body: { action: 'SKIP', step: 0 } }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('offers to continue an interrupted tour where it stopped, and finishes it', async () => {
    const { posts } = renderHost({ tours: [{ role: 'OWNER', status: 'IN_PROGRESS', step: 14, offer: true }] });
    const welcome = await screen.findByRole('dialog', { name: 'Welcome to TruHost' });
    expect(within(welcome).getByText(/pick up the tour where we left off/)).toBeInTheDocument();
    await userEvent.click(within(welcome).getByRole('button', { name: 'Continue the tour' }));
    const last = await screen.findByRole('dialog', { name: 'Help is always here' });
    expect(within(last).getByText('Sage · Step 15 of 15')).toBeInTheDocument();
    // Finishing fades the tour out, then records it and closes.
    await userEvent.click(within(last).getByRole('button', { name: 'Finish' }));
    await waitFor(() => expect(posts.at(-1)).toEqual({ role: 'OWNER', body: { action: 'COMPLETE' } }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows each page’s content, not its header: the calendar, then the month at a glance', async () => {
    const { router } = renderHost({ tours: [{ role: 'OWNER', status: 'IN_PROGRESS', step: 8, offer: true }] });
    await userEvent.click(await screen.findByRole('button', { name: 'Continue the tour' }));
    expect(await screen.findByRole('dialog', { name: 'Questions?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(await screen.findByRole('dialog', { name: 'Your calendar' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/owner/calendar');
    await userEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(await screen.findByRole('dialog', { name: 'The month at a glance' })).toBeInTheDocument();
  });

  it('says there’s more to see when a finished tour has changed since', async () => {
    renderHost({ tours: [{ role: 'OWNER', status: 'COMPLETED', step: null, offer: true }] });
    expect(await screen.findByText(/There’s more to see in your owner portal/)).toBeInTheDocument();
  });

  it('shows no welcome once the tours are done', async () => {
    renderHost({ tours: [{ role: 'OWNER', status: 'COMPLETED', step: null, offer: false }] });
    await screen.findByText('Your month');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
