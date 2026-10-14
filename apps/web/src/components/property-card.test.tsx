import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
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

async function renderCard(wide: boolean) {
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
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByText('Petersburg Retreat');
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
});
