import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ApiClient } from '@truhost/api-client';
import { ApiContext } from '../lib/api-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { PropertyCard } from './property-card';

const PROPERTY = {
  id: 'p1',
  name: 'Petersburg Retreat',
  location: 'Chilliwack, BC',
  archived: false,
  hasPlan: true,
  photoUrl: null,
};
const FIGURES = { occupancyBps: 3900, grossCents: 139_856, nightsBooked: 12 };

async function renderCard(wide: boolean, GET = vi.fn(() => new Promise(() => undefined))) {
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <PropertyCard property={PROPERTY} index={0} revenueLabel="Gross, Oct" figures={FIGURES} wide={wide} />
      ),
    }),
    history: createMemoryHistory({ initialEntries: ['/admin'] }),
  });
  render(
    // The cover photo refreshes its signed link through a query.
    <ApiContext.Provider value={{ GET } as unknown as ApiClient}>
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ApiContext.Provider>,
  );
  await screen.findByText('Petersburg Retreat');
  return GET;
}

describe('property card', () => {
  it('shows occupancy and gross', async () => {
    await renderCard(false);
    expect(screen.getByText('39%')).toBeInTheDocument();
    expect(screen.getByText('$1,398.56')).toBeInTheDocument();
    expect(screen.queryByText('Nights booked')).not.toBeInTheDocument();
  });

  it('with a row to itself, adds nights booked (shown once the card is wide enough)', async () => {
    await renderCard(true);
    expect(screen.getByText('Nights booked')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Petersburg Retreat/ })).toHaveAttribute('href', '/admin/properties/p1');
  });

  it('starts loading the property and its rooms when the pointer reaches it, so its page opens ready', async () => {
    const GET = await renderCard(false);
    expect(GET).not.toHaveBeenCalled();
    fireEvent.mouseEnter(screen.getByRole('link'));
    expect(GET.mock.calls.map((c) => (c as unknown[])[0])).toEqual([
      '/v1/properties/{id}',
      '/v1/properties/{id}/rooms',
    ]);
  });
});
