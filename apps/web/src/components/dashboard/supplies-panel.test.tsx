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
): RestockItem => ({
  id,
  propertyId: property,
  property: { id: property, name: property === 'p1' ? 'Cedar Cabin' : 'Seaside Loft' },
  name,
  category: 'OTHER',
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
  it('lists what to restock now and soon as tiles, most urgent first, each saying which property', async () => {
    await renderPanel([
      item('a', 'p2', 'Coffee pods', 0, 'OUT'),
      item('b', 'p1', 'Toilet paper', 25, 'LOW'),
      item('c', 'p2', 'Shampoo', 50, 'SOON'),
    ]);
    expect(screen.getByText('2 to restock · 1 low soon')).toBeInTheDocument();
    const tiles = screen.getAllByRole('listitem');
    expect(tiles.map((t) => within(t).getByRole('meter').getAttribute('aria-label'))).toEqual([
      'Coffee pods level',
      'Toilet paper level',
      'Shampoo level',
    ]);
    expect(within(tiles[0]!).getByText('Out')).toBeInTheDocument();
    expect(within(tiles[2]!).getByText('Low soon')).toBeInTheDocument();
    expect(within(tiles[0]!).getByRole('link', { name: 'Seaside Loft' })).toHaveAttribute(
      'href',
      '/admin/properties/p2',
    );
    expect(screen.getByRole('meter', { name: 'Toilet paper level' })).toHaveAttribute('aria-valuenow', '25');
    expect(screen.getByRole('link', { name: 'See all' })).toHaveAttribute('href', '/admin/supplies');
  });

  it('leaves the property out when the dashboard shows one property', async () => {
    await renderPanel([item('a', 'p2', 'Coffee pods', 0, 'OUT')], false);
    expect(screen.queryByRole('link', { name: 'Seaside Loft' })).not.toBeInTheDocument();
  });

  it('shows eight at most, and says how many more are on Supplies', async () => {
    await renderPanel(Array.from({ length: 10 }, (_, i) => item(`i${i}`, 'p1', `Item ${i}`, 25, 'LOW')));
    expect(screen.getAllByRole('meter')).toHaveLength(8);
    expect(screen.getByText(/\+2 more on/)).toBeInTheDocument();
  });

  it('says all is stocked when nothing is at or near its restock point', async () => {
    await renderPanel([]);
    expect(screen.getByText('All stocked')).toBeInTheDocument();
  });
});
