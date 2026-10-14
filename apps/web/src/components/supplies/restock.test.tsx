import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import type { ApiClient } from '@truhost/api-client';
import type { RestockItem } from '@truhost/shared';
import { ApiContext } from '../../lib/api-context';
import { RestockList } from './restock-list';
import { RestockSummary } from './restock-summary';

const item = (id: string, property: 'p1' | 'p2', name: string, levelPct: number, urgency: RestockItem['urgency']) =>
  ({
    id,
    propertyId: property,
    property: { id: property, name: property === 'p1' ? 'Petersburg Retreat' : 'Cedar Cabin' },
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

const ITEMS = [
  item('a', 'p1', 'Conditioner', 0, 'OUT'),
  item('b', 'p2', 'Coffee pods', 0, 'OUT'),
  item('c', 'p1', 'Hand soap', 25, 'LOW'),
  item('d', 'p1', 'Paper towels', 50, 'SOON'),
];

async function renderPage() {
  const POST = vi.fn(() => Promise.resolve({ data: { items: [] }, response: new Response(null, { status: 201 }) }));
  const api = { POST } as unknown as ApiClient;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <ApiContext.Provider value={api}>
          <QueryClientProvider client={client}>
            <RestockSummary items={ITEMS} />
            <RestockList items={ITEMS} />
          </QueryClientProvider>
        </ApiContext.Provider>
      ),
    }),
    history: createMemoryHistory({ initialEntries: ['/admin/supplies'] }),
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { name: 'Petersburg Retreat' });
  return POST;
}

describe('supplies page', () => {
  it('counts what’s out, running low and low soon', async () => {
    await renderPage();
    const tile = (label: string) => screen.getByRole('heading', { name: label, level: 3 }).closest('section')!;
    expect(within(tile('Out')).getByText('2')).toBeInTheDocument();
    expect(within(tile('Out')).getByText('Across 2 properties')).toBeInTheDocument();
    expect(within(tile('Running low')).getByText('1')).toBeInTheDocument();
    expect(within(tile('Low soon')).getByText('1')).toBeInTheDocument();
  });

  it('gives each property a full card of tiles, with a link to all its supplies', async () => {
    await renderPage();
    const card = screen.getByRole('heading', { name: 'Petersburg Retreat' }).closest('section')!;
    expect(within(card).getByText('2 to restock · 1 low soon')).toBeInTheDocument();
    expect(within(card).getAllByRole('listitem')).toHaveLength(3);
    expect(within(card).getByRole('link', { name: /All supplies/ })).toHaveAttribute('href', '/admin/properties/p1');
  });

  it('“Restocked” marks the item full', async () => {
    const POST = await renderPage();
    const tile = screen.getByText('Hand soap').closest('li')!;
    await userEvent.click(within(tile).getByRole('button', { name: 'Restocked' }));
    expect(POST).toHaveBeenCalledWith('/v1/properties/{id}/supply-statuses', {
      params: { path: { id: 'p1' } },
      body: { readings: [{ supplyItemId: 'c', levelPct: 100, note: null }] },
    });
  });
});
