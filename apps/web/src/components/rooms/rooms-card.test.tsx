import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ApiClient } from '@truhost/api-client';
import { roomDisplayNames, type Room } from '@truhost/shared';
import { ApiContext } from '../../lib/api-context';
import { RoomsCard } from './rooms-card';

const ok = (data: unknown, status = 200) => ({ data, response: new Response(null, { status }) });
const named = (rooms: Omit<Room, 'displayName' | 'propertyId' | 'archivedAt'>[]): Room[] => {
  const names = roomDisplayNames(rooms);
  return rooms.map((r) => ({ ...r, propertyId: 'p1', archivedAt: null, displayName: names.get(r.id)! }));
};

function setup(initial: Room[]) {
  let rooms = initial;
  const api = {
    GET: vi.fn(async () => ok({ items: rooms, nextCursor: null })),
    POST: vi.fn(async (path: string, init: { body?: unknown }) => {
      if (path.endsWith('/bulk')) {
        rooms = named(
          (init.body as { rooms: { type: Room['type'] }[] }).rooms.map((r, i) => ({
            ...r,
            id: `n${i}`,
            label: null,
            position: i,
          })),
        );
        return ok({ items: rooms, nextCursor: null }, 201);
      }
      return ok({}, 201);
    }),
    PATCH: vi.fn(async () => ok({})),
    PUT: vi.fn(async (_path: string, init: { body: { roomIds: string[] } }) => {
      const byId = new Map(rooms.map((r) => [r.id, r]));
      rooms = named(init.body.roomIds.map((id, i) => ({ ...byId.get(id)!, position: i })));
      return ok({ items: rooms, nextCursor: null });
    }),
  };
  render(
    <ApiContext.Provider value={api as unknown as ApiClient}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <RoomsCard propertyId="p1" layout={{ bedrooms: 2, bathrooms: 1, halfBathrooms: null }} />
      </QueryClientProvider>
    </ApiContext.Provider>,
  );
  return api;
}

const u = () => userEvent.setup();

// dnd-kit measures rows to move them with the keyboard; jsdom has no layout, so give each row a place.
beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const row = this.closest('li');
    const index = row ? [...(row.parentElement?.children ?? [])].indexOf(row) : 0;
    const top = index * 56;
    return {
      x: 0,
      y: top,
      top,
      left: 0,
      right: 600,
      bottom: top + 48,
      width: 600,
      height: 48,
      toJSON: () => ({}),
    } as DOMRect;
  });
});
afterEach(() => vi.restoreAllMocks());

describe('RoomsCard', () => {
  it('offers quick setup for a property with no rooms, starting from its layout', async () => {
    const api = setup([]);
    expect(await screen.findByRole('heading', { name: 'Quick setup' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Bedroom' })).toHaveTextContent('2');
    const user = u();
    await user.click(screen.getByRole('button', { name: 'One more hot tub' }));
    await user.click(screen.getByRole('button', { name: 'One fewer bedroom' }));
    expect(screen.getByText('5 rooms will be created.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create rooms' }));
    expect(api.POST).toHaveBeenCalledWith('/v1/properties/{id}/rooms/bulk', {
      params: { path: { id: 'p1' } },
      body: {
        rooms: [
          { type: 'BEDROOM' },
          { type: 'BATHROOM' },
          { type: 'KITCHEN' },
          { type: 'LIVING' },
          { type: 'HOT_TUB' },
        ],
      },
    });
    expect(await screen.findByText('Hot tub')).toBeInTheDocument();
  });

  it('adds one room with a type chip and a label, previewing its name and refusing a clash', async () => {
    const api = setup(named([{ id: 'a', type: 'BEDROOM', label: 'Primary', position: 0 }]));
    const user = u();
    await user.click(await screen.findByRole('button', { name: 'Add a room' }));
    expect(screen.getByRole('textbox', { name: 'Label' })).toHaveAttribute(
      'placeholder',
      'Optional, e.g. Primary, Ensuite, Loft',
    );
    expect(screen.getByText('Bedroom 2')).toBeInTheDocument(); // the preview

    await user.type(screen.getByRole('textbox', { name: 'Label' }), 'primary');
    expect(screen.getByText(/There’s already a room called “Bedroom · primary”/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add room' })).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: 'Other' }));
    await user.clear(screen.getByRole('textbox', { name: 'Label' }));
    expect(screen.getByRole('button', { name: 'Add room' })).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Label' }), 'Wine cellar');
    expect(screen.getByText('Other · Wine cellar')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add room' }));
    expect(api.POST).toHaveBeenCalledWith('/v1/properties/{id}/rooms', {
      params: { path: { id: 'p1' } },
      body: { type: 'OTHER', label: 'Wine cellar' },
    });
  });

  it('edits a room’s type and label inline, and deletes after confirming', async () => {
    const api = setup(
      named([
        { id: 'a', type: 'BEDROOM', label: null, position: 0 },
        { id: 'b', type: 'BEDROOM', label: null, position: 1 },
      ]),
    );
    const user = u();
    await user.click(await screen.findByRole('button', { name: 'Edit Bedroom 1' }));
    const form = screen.getByRole('form', { name: 'Edit Bedroom 1' });
    await user.type(within(form).getByRole('textbox', { name: 'Label' }), 'Primary');
    await user.click(within(form).getByRole('radio', { name: 'Office' }));
    expect(within(form).getByText('Office · Primary')).toBeInTheDocument();
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    expect(api.PATCH).toHaveBeenCalledWith('/v1/rooms/{id}', {
      params: { path: { id: 'a' } },
      body: { type: 'OFFICE', label: 'Primary' },
    });

    await user.click(screen.getByRole('button', { name: 'Delete Bedroom 2' }));
    expect(screen.getByRole('dialog', { name: 'Delete Bedroom 2?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete room' }));
    expect(api.POST).toHaveBeenCalledWith('/v1/rooms/{id}/archive', { params: { path: { id: 'b' } } });
  });

  it('reorders with the keyboard: Space to pick up, arrow down, Space to drop', async () => {
    const api = setup(
      named([
        { id: 'a', type: 'KITCHEN', label: null, position: 0 },
        { id: 'b', type: 'BEDROOM', label: null, position: 1 },
        { id: 'c', type: 'BATHROOM', label: null, position: 2 },
      ]),
    );
    const user = u();
    const handle = await screen.findByRole('button', { name: 'Reorder Kitchen' });
    handle.focus();
    await user.keyboard(' ');
    await user.keyboard('{ArrowDown}');
    await user.keyboard(' ');
    await waitFor(() =>
      expect(api.PUT).toHaveBeenCalledWith('/v1/properties/{id}/rooms/order', {
        params: { path: { id: 'p1' } },
        body: { roomIds: ['b', 'a', 'c'] },
      }),
    );
    const list = screen.getByRole('list', { name: 'Rooms in walkthrough order' });
    await waitFor(() =>
      expect(
        within(list)
          .getAllByRole('listitem')
          .map((li) => li.textContent),
      ).toEqual([
        expect.stringContaining('Bedroom'),
        expect.stringContaining('Kitchen'),
        expect.stringContaining('Bathroom'),
      ]),
    );
  });
});
