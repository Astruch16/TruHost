import { describe, expect, it } from 'vitest';
import type { Room } from '@truhost/shared';
import { previewRoomName, quickSetupCounts, reorderedRooms, roomsFromCounts } from './rooms';

const room = (id: string, type: Room['type'], label: string | null, position: number): Room => ({
  id,
  propertyId: 'p',
  type,
  label,
  displayName: '',
  position,
  archivedAt: null,
});

describe('quick setup', () => {
  it('starts from the property’s layout, with a kitchen and a living room', () => {
    const counts = quickSetupCounts({ bedrooms: 3, bathrooms: 2, halfBathrooms: 1 });
    expect(counts).toMatchObject({ BEDROOM: 3, BATHROOM: 2, HALF_BATH: 1, KITCHEN: 1, LIVING: 1, GARAGE: 0, OTHER: 0 });
    expect(quickSetupCounts({ bedrooms: null, bathrooms: null, halfBathrooms: null })).toMatchObject({
      BEDROOM: 1,
      BATHROOM: 1,
      HALF_BATH: 0,
    });
    expect(quickSetupCounts({ bedrooms: 0, bathrooms: 99, halfBathrooms: null })).toMatchObject({
      BEDROOM: 0,
      BATHROOM: 20,
    });
  });

  it('creates each type’s count in the order types are offered, never Other', () => {
    const counts = quickSetupCounts({ bedrooms: 2, bathrooms: 1, halfBathrooms: 0 });
    counts.OTHER = 3;
    counts.HOT_TUB = 1;
    expect(roomsFromCounts(counts).map((r) => r.type)).toEqual([
      'BEDROOM',
      'BEDROOM',
      'BATHROOM',
      'KITCHEN',
      'LIVING',
      'HOT_TUB',
    ]);
  });
});

describe('name previews', () => {
  const rooms = [room('a', 'BEDROOM', 'Primary', 0), room('b', 'BATHROOM', null, 1)];

  it('shows what a new room will be called', () => {
    expect(previewRoomName(rooms, { type: 'BEDROOM', label: '' })).toMatchObject({ name: 'Bedroom 2', clash: null });
    expect(previewRoomName(rooms, { type: 'KITCHEN', label: '' }).name).toBe('Kitchen');
    expect(previewRoomName(rooms, { type: 'BATHROOM', label: ' Ensuite ' }).name).toBe('Bathroom · Ensuite');
  });

  it('spots a name that’s taken, and an Other room without a label', () => {
    expect(previewRoomName(rooms, { type: 'BEDROOM', label: 'primary' }).clash).toBe('Bedroom · primary');
    expect(previewRoomName(rooms, { type: 'OTHER', label: '  ' }).needsLabel).toBe(true);
    expect(previewRoomName(rooms, { type: 'OTHER', label: 'Wine cellar' }).needsLabel).toBe(false);
  });

  it('previews an edit in place', () => {
    expect(previewRoomName(rooms, { id: 'a', type: 'BEDROOM', label: '' })).toMatchObject({
      name: 'Bedroom',
      clash: null,
    });
    expect(previewRoomName(rooms, { id: 'b', type: 'BEDROOM', label: 'Primary' }).clash).toBe('Bedroom · Primary');
  });
});

it('renumbers after a move, as the API will', () => {
  const rooms = [room('a', 'BEDROOM', null, 0), room('b', 'KITCHEN', null, 1), room('c', 'BEDROOM', null, 2)];
  expect(reorderedRooms(rooms, 2, 0).map((r) => [r.id, r.displayName, r.position])).toEqual([
    ['c', 'Bedroom 1', 0],
    ['a', 'Bedroom 2', 1],
    ['b', 'Kitchen', 2],
  ]);
});
