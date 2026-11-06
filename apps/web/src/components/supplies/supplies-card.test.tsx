import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ApiClient } from '@truhost/api-client';
import type { SupplyCategory } from '@truhost/shared';
import { ApiContext } from '../../lib/api-context';
import { SuppliesCard } from './supplies-card';

const supply = (id: string, name: string, category: SupplyCategory, position: number) => ({
  id,
  propertyId: 'p1',
  name,
  category,
  thresholdPct: 25,
  position,
  levelPct: 50,
  state: 'OK',
  lastCheckedAt: null,
  archivedAt: null,
});

function renderCard(mode: 'report' | 'view') {
  const items = [
    supply('a', 'Toilet paper', 'BATHROOM', 0),
    supply('b', 'Shampoo', 'BATHROOM', 1),
    supply('c', 'Dish soap', 'KITCHEN', 0),
  ];
  const api = {
    GET: () => Promise.resolve({ data: { items }, response: new Response(null, { status: 200 }) }),
  } as unknown as ApiClient;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ApiContext.Provider value={api}>
      <QueryClientProvider client={client}>
        <SuppliesCard propertyId="p1" mode={mode} />
      </QueryClientProvider>
    </ApiContext.Provider>,
  );
}

describe('SuppliesCard areas', () => {
  it('heads each area with its icon, name and count, a thin line between areas', async () => {
    renderCard('report');
    const bathroom = await screen.findByRole('region', { name: 'Bathroom' });
    const kitchen = screen.getByRole('region', { name: 'Kitchen' });
    expect(within(bathroom).getByRole('heading', { level: 3 })).toHaveTextContent('Bathroom 2 items');
    expect(within(kitchen).getByRole('heading', { level: 3 })).toHaveTextContent('Kitchen 1 item');
    expect(within(bathroom).getByRole('heading', { level: 3 }).querySelector('svg[aria-hidden]')).not.toBeNull();
    // The line sits above every area but the first.
    expect(bathroom).toHaveClass('first-of-type:border-t-0');
    expect(kitchen).toHaveClass('border-t', 'border-line-soft');
    expect(bathroom.previousElementSibling?.tagName).not.toBe('SECTION');
    expect(kitchen.previousElementSibling).toBe(bathroom);
  });

  it('shows owners one list, with no area headings', async () => {
    renderCard('view');
    expect(await screen.findByRole('region', { name: 'Supplies' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
  });
});
