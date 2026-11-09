import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import type { RestockItem } from '@truhost/shared';
import { SuppliesPanel } from './supplies-panel';

const item = (
  id: string,
  property: string,
  name: string,
  levelPct: number,
  urgency: RestockItem['urgency'],
  category: RestockItem['category'] = 'OTHER',
): RestockItem => ({
  id,
  propertyId: property,
  property: { id: property, name: property === 'p1' ? 'Cedar Cabin' : 'Seaside Loft' },
  name,
  category,
  thresholdPct: 25,
  position: 0,
  levelPct,
  state: levelPct === 0 ? 'OUT' : levelPct <= 25 ? 'LOW' : 'OK',
  lastCheckedAt: null,
  archivedAt: null,
  urgency,
});

/** Renders the panel inside a router (it links to Supplies and to each property). */
async function renderPanel(items: RestockItem[], showProperty = true) {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => <SuppliesPanel items={items} showProperty={showProperty} /> }),
    history: createMemoryHistory({ initialEntries: ['/admin'] }),
  });
  render(<RouterProvider router={router} />);
  return screen.findByRole('heading', { name: 'Supplies' });
}

describe('dashboard supplies card', () => {
  it('lists what to restock in a column per room, most urgent first in each, each saying which property', async () => {
    await renderPanel([
      item('a', 'p2', 'Coffee pods', 0, 'OUT', 'KITCHEN'),
      item('b', 'p1', 'Toilet paper', 25, 'LOW', 'BATHROOM'),
      item('c', 'p2', 'Dish soap', 25, 'LOW', 'KITCHEN'),
      item('d', 'p2', 'Shampoo', 50, 'SOON', 'BATHROOM'),
    ]);
    expect(screen.getByText('3 to restock · 1 low soon')).toBeInTheDocument();
    // Rooms in the Supplies page's order, even though Kitchen holds the most urgent item.
    const rooms = screen.getAllByRole('region').map((room) => [
      room.getAttribute('aria-label'),
      within(room)
        .getAllByRole('meter')
        .map((bar) => bar.getAttribute('aria-label')),
    ]);
    expect(rooms).toEqual([
      ['Bathroom', ['Toilet paper level', 'Shampoo level']],
      ['Kitchen', ['Coffee pods level', 'Dish soap level']],
    ]);
    expect(screen.getByRole('heading', { name: 'Bathroom 2 items', level: 3 })).toBeInTheDocument();
    const coffee = screen.getByRole('meter', { name: 'Coffee pods level' }).closest('li')!;
    expect(coffee).toHaveTextContent('Coffee pods: Out');
    expect(coffee).toHaveTextContent('Empty');
    expect(within(coffee).getByRole('link', { name: 'Seaside Loft' })).toHaveAttribute('href', '/admin/properties/p2');
    expect(screen.getByRole('meter', { name: 'Toilet paper level' })).toHaveAttribute('aria-valuenow', '25');
    expect(screen.getByRole('link', { name: 'See all' })).toHaveAttribute('href', '/admin/supplies');
  });

  it('leaves the property out when the dashboard shows one property', async () => {
    await renderPanel([item('a', 'p2', 'Coffee pods', 0, 'OUT')], false);
    expect(screen.queryByRole('link', { name: 'Seaside Loft' })).not.toBeInTheDocument();
  });

  it('shows six a room at most, and says how many more are on Supplies', async () => {
    await renderPanel([
      ...Array.from({ length: 10 }, (_, i) => item(`b${i}`, 'p1', `Item ${i}`, 25, 'LOW', 'BATHROOM')),
      item('k', 'p1', 'Dish soap', 25, 'LOW', 'KITCHEN'),
    ]);
    const bathroom = screen.getByRole('region', { name: 'Bathroom' });
    expect(within(bathroom).getAllByRole('meter')).toHaveLength(6);
    expect(within(bathroom).getByText(/\+4 more on/)).toBeInTheDocument();
    expect(within(bathroom).getByRole('heading', { level: 3 })).toHaveTextContent('Bathroom 10 items');
    expect(within(screen.getByRole('region', { name: 'Kitchen' })).queryByText(/more on/)).not.toBeInTheDocument();
  });

  it('says all is stocked when nothing is at or near its restock point', async () => {
    await renderPanel([]);
    expect(screen.getByText('All stocked')).toBeInTheDocument();
  });
});
