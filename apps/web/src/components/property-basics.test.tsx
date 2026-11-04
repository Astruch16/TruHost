import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ApiClient } from '@truhost/api-client';
import type { RoomType } from '@truhost/shared';
import { ApiContext } from '../lib/api-context';
import { PropertyRoomsCard } from './property-basics';

const room = (id: string, type: RoomType, displayName: string, position: number) => ({
  id,
  propertyId: 'p1',
  type,
  label: null,
  number: 1,
  position,
  archivedAt: null,
  displayName,
});

describe('PropertyRoomsCard', () => {
  it('numbers the rooms as steps of the walkthrough, not as how many', async () => {
    const items = [
      room('a', 'BEDROOM', 'Bedroom', 0),
      room('b', 'BEDROOM', 'Bedroom 2', 1),
      room('c', 'KITCHEN', 'Kitchen', 2),
    ];
    const api = {
      GET: () => Promise.resolve({ data: { items, nextCursor: null }, response: new Response(null, { status: 200 }) }),
    } as unknown as ApiClient;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <ApiContext.Provider value={api}>
        <QueryClientProvider client={client}>
          <PropertyRoomsCard propertyId="p1" />
        </QueryClientProvider>
      </ApiContext.Provider>,
    );
    const list = await screen.findByRole('list');
    expect(screen.getByText('The order the cleaning checklist goes through them, first to last.')).toBeInTheDocument();
    const steps = within(list).getAllByRole('listitem');
    // Read aloud as steps; shown as a numbered circle before the icon, nothing after the name.
    expect(steps.map((li) => li.textContent)).toEqual(['1Step 1: Bedroom', '2Step 2: Bedroom 2', '3Step 3: Kitchen']);
    expect(steps.map((li) => li.lastElementChild?.textContent)).toEqual([
      'Step 1: Bedroom',
      'Step 2: Bedroom 2',
      'Step 3: Kitchen',
    ]);
    // A line runs down to the next step, and none after the last.
    expect(steps.map((li) => li.querySelectorAll('.bg-line').length)).toEqual([1, 1, 0]);
  });
});
