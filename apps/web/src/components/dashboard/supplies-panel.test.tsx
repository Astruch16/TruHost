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
async function renderPanel(items: RestockItem[]) {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => <SuppliesPanel items={items} /> }),
    history: createMemoryHistory({ initialEntries: ['/admin'] }),
  });
  render(<RouterProvider router={router} />);
  return screen.findByRole('heading', { name: 'Supplies' });
}

describe('dashboard supplies card', () => {
  it('lists what to restock now and soon, grouped by property, most urgent first', async () => {
    await renderPanel([
      item('a', 'p2', 'Coffee pods', 0, 'OUT'),
      item('b', 'p1', 'Toilet paper', 25, 'LOW'),
      item('c', 'p2', 'Shampoo', 50, 'SOON'),
    ]);
    expect(screen.getByText('2 to restock · 1 low soon')).toBeInTheDocument();
    const groups = screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'));
    expect(groups).toEqual(['Seaside Loft', 'Cedar Cabin']);
    const seaside = within(screen.getByRole('region', { name: 'Seaside Loft' }));
    expect(seaside.getByText('Coffee pods')).toBeInTheDocument();
    expect(seaside.getByText('Out')).toBeInTheDocument();
    expect(seaside.getByText('Low soon')).toBeInTheDocument();
    expect(seaside.getByRole('link', { name: 'Seaside Loft' })).toHaveAttribute('href', '/admin/properties/p2');
    expect(screen.getByRole('meter', { name: 'Toilet paper level' })).toHaveAttribute('aria-valuenow', '25');
    expect(screen.getByRole('link', { name: 'See all' })).toHaveAttribute('href', '/admin/supplies');
  });

  it('shows six at most, and says how many more are on Supplies', async () => {
    await renderPanel(Array.from({ length: 8 }, (_, i) => item(`i${i}`, 'p1', `Item ${i}`, 25, 'LOW')));
    expect(screen.getAllByRole('meter')).toHaveLength(6);
    expect(screen.getByText(/\+2 more on/)).toBeInTheDocument();
  });

  it('says all is stocked when nothing is at or near its restock point', async () => {
    await renderPanel([]);
    expect(screen.getByText('All stocked')).toBeInTheDocument();
  });
});
