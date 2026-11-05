import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ApiClient } from '@truhost/api-client';
import type { Property, RoomType } from '@truhost/shared';
import { ApiContext } from '../lib/api-context';
import { PropertyAddressCard, PropertyRoomsCard } from './property-basics';

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
    expect(
      screen.getByText('3 rooms, numbered in the order the cleaning checklist goes through them.'),
    ).toBeInTheDocument();
    const steps = within(list).getAllByRole('listitem');
    // Read aloud as steps; shown as a number badge on the icon, nothing after the name.
    expect(steps.map((li) => li.textContent)).toEqual(['1Step 1: Bedroom', '2Step 2: Bedroom 2', '3Step 3: Kitchen']);
    expect(steps.map((li) => li.lastElementChild?.textContent)).toEqual([
      'Step 1: Bedroom',
      'Step 2: Bedroom 2',
      'Step 3: Kitchen',
    ]);
    // The badge is visual only: the sr-only "Step N" says it.
    expect(steps.map((li) => li.querySelector('[aria-hidden="true"].bg-ink')?.textContent)).toEqual(['1', '2', '3']);
  });
});

const property = {
  addressLine1: '12 Example St',
  addressLine2: 'Unit 4',
  city: 'Vancouver',
  province: 'BC',
  postalCode: 'V6K 1A1',
  checkInTime: '16:00',
  checkOutTime: '11:00',
} as Property;

describe('PropertyAddressCard', () => {
  it('links to directions, copies the address and shows both stay times', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<PropertyAddressCard property={property} />);

    expect(screen.getByText('12 Example St, Unit 4')).toBeInTheDocument();
    expect(screen.getByText('Vancouver, BC V6K 1A1')).toBeInTheDocument();
    const directions = screen.getByRole('link', { name: 'Directions (opens in a new tab)' });
    expect(directions).toHaveAttribute(
      'href',
      'https://www.google.com/maps/dir/?api=1&destination=12%20Example%20St%2C%20Unit%204%2C%20Vancouver%2C%20BC%20V6K%201A1',
    );
    expect(directions).toHaveAttribute('target', '_blank');
    expect(directions).toHaveAttribute('rel', 'noopener noreferrer');

    fireEvent.click(screen.getByRole('button', { name: 'Copy address' }));
    expect(writeText).toHaveBeenCalledWith('12 Example St, Unit 4, Vancouver, BC V6K 1A1');
    expect(await screen.findByRole('button', { name: 'Address copied' })).toBeInTheDocument();

    const terms = screen.getAllByRole('term').map((t) => t.textContent);
    const values = screen.getAllByRole('definition').map((d) => d.textContent);
    expect(terms).toEqual(['Check-out', 'Check-in']);
    expect(values).toEqual(['11:00', '16:00']);
  });
});
