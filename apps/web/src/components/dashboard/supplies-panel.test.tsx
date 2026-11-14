import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import type { RestockItem } from '@truhost/shared';
import { SuppliesPanel } from './supplies-panel';

const item = (id: string, property: string, name: string, levelPct: number, urgency: RestockItem['urgency']) =>
  ({
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
  }) as RestockItem;

async function renderPanel(items: RestockItem[], showProperty = true) {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => <SuppliesPanel items={items} showProperty={showProperty} /> }),
    history: createMemoryHistory({ initialEntries: ['/admin'] }),
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { name: 'Supplies' });
}

describe('dashboard supplies card', () => {
  it('sums up what to restock and lists the five most urgent, each with its property and level', async () => {
    await renderPanel([
      item('a', 'p2', 'Coffee pods', 0, 'OUT'),
      item('b', 'p1', 'Toilet paper', 25, 'LOW'),
      item('c', 'p1', 'Hand soap', 25, 'LOW'),
      item('d', 'p2', 'Shampoo', 25, 'LOW'),
      item('e', 'p1', 'Dish soap', 50, 'SOON'),
      item('f', 'p2', 'Paper towels', 50, 'SOON'),
      item('g', 'p1', 'Laundry detergent', 50, 'SOON'),
    ]);
    expect(screen.getByText('4 to restock · 3 low soon')).toBeInTheDocument();
    const rows = within(screen.getByRole('list', { name: 'Most urgent' })).getAllByRole('listitem');
    expect(rows).toHaveLength(5);
    expect(rows[0]).toHaveTextContent('Coffee pods: OutSeaside LoftEmpty');
    expect(within(rows[1]!).getByRole('meter', { name: 'Toilet paper level' })).toHaveAttribute('aria-valuenow', '25');
    expect(screen.getByText(/\+2 more on/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See all' })).toHaveAttribute('href', '/admin/supplies');
  });

  it('leaves the property out when the dashboard shows one property', async () => {
    await renderPanel([item('a', 'p2', 'Coffee pods', 0, 'OUT')], false);
    expect(screen.queryByText('Seaside Loft')).not.toBeInTheDocument();
  });

  it('says all is stocked when nothing is at or near its restock point', async () => {
    await renderPanel([]);
    expect(screen.getByText('All stocked')).toBeInTheDocument();
  });
});
