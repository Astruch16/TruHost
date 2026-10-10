import { describe, expect, it } from 'vitest';
import { createRoom, createRooms, updateRoom } from './api/properties.js';
import type { RoomType } from './enums.js';
import { duplicateRoomName, nextRoomNumber, normalizeRoomLabel, roomDisplayNames } from './rooms.js';

/** Rooms as [type, label, number], in walkthrough order. */
const names = (rooms: [RoomType, string | null, number][]) => [
  ...roomDisplayNames(rooms.map(([type, label, number], i) => ({ id: String(i), type, label, number }))).values(),
];

describe('room display names', () => {
  it.each<[string, [RoomType, string | null, number][], string[]]>([
    ['the only room of its type is just the type', [['KITCHEN', null, 1]], ['Kitchen']],
    [
      'several of a type show their own numbers',
      [
        ['BEDROOM', null, 1],
        ['KITCHEN', null, 1],
        ['BEDROOM', null, 2],
      ],
      ['Bedroom 1', 'Kitchen', 'Bedroom 2'],
    ],
    ['a label is shown after the type', [['BEDROOM', 'Primary', 1]], ['Bedroom · Primary']],
    [
      'a labelled room keeps its number out of sight',
      [
        ['BEDROOM', 'Primary', 1],
        ['BEDROOM', null, 2],
        ['BEDROOM', null, 3],
      ],
      ['Bedroom · Primary', 'Bedroom 2', 'Bedroom 3'],
    ],
    [
      'a gap left by a deleted room stays a gap',
      [
        ['BEDROOM', null, 1],
        ['BEDROOM', null, 3],
      ],
      ['Bedroom 1', 'Bedroom 3'],
    ],
    [
      'types with spaces and Other',
      [
        ['HALF_BATH', null, 1],
        ['PATIO_DECK', null, 1],
        ['OTHER', 'Wine cellar', 1],
        ['LIVING', 'Loft', 1],
      ],
      ['Half bath', 'Patio/Deck', 'Other · Wine cellar', 'Living room · Loft'],
    ],
    ['labels are tidied', [['BEDROOM', '  Kids   room ', 1]], ['Bedroom · Kids room']],
    ['an empty label counts as none', [['BEDROOM', '   ', 1]], ['Bedroom']],
  ])('%s', (_case, rooms, expected) => expect(names(rooms)).toEqual(expected));

  it('never depends on the walkthrough order', () => {
    const rooms: [RoomType, string | null, number][] = [
      ['BEDROOM', null, 1],
      ['BATHROOM', null, 1],
      ['BEDROOM', null, 2],
      ['BEDROOM', 'Loft', 3],
      ['BATHROOM', null, 2],
    ];
    const byRoom = (order: number[]) =>
      Object.fromEntries(
        roomDisplayNames(
          order.map((i) => ({ id: String(i), type: rooms[i]![0], label: rooms[i]![1], number: rooms[i]![2] })),
        ),
      );
    const base = byRoom([0, 1, 2, 3, 4]);
    for (const order of [
      [4, 3, 2, 1, 0],
      [2, 0, 4, 1, 3],
      [3, 4, 0, 2, 1],
    ]) {
      expect(byRoom(order)).toEqual(base);
    }
  });

  it('finds two rooms that would share a name, ignoring case', () => {
    expect(
      duplicateRoomName(
        names([
          ['BEDROOM', 'Primary', 1],
          ['BEDROOM', 'primary', 2],
        ]),
      ),
    ).toBe('Bedroom · primary');
    expect(
      duplicateRoomName(
        names([
          ['BEDROOM', null, 1],
          ['BEDROOM', null, 2],
          ['BEDROOM', 'Loft', 3],
        ]),
      ),
    ).toBeNull();
    // A label that looks like a number never collides with a numbered room ("Bedroom · 2" vs "Bedroom 2").
    expect(
      duplicateRoomName(
        names([
          ['BEDROOM', null, 1],
          ['BEDROOM', null, 2],
          ['BEDROOM', '2', 3],
        ]),
      ),
    ).toBeNull();
  });
});

describe('room numbers', () => {
  const held = (type: RoomType, ...numbers: number[]) => numbers.map((number) => ({ type, number }));

  it('fill from the next free number for the type', () => {
    expect(nextRoomNumber([], 'BEDROOM')).toBe(1);
    expect(nextRoomNumber(held('BEDROOM', 1, 2), 'BEDROOM')).toBe(3);
    expect(nextRoomNumber(held('BEDROOM', 2, 3), 'BEDROOM')).toBe(1);
    expect(nextRoomNumber(held('BEDROOM', 1, 3), 'BEDROOM')).toBe(2);
    // Other types don't count.
    expect(nextRoomNumber([...held('BATHROOM', 1, 2), ...held('BEDROOM', 1)], 'BATHROOM')).toBe(3);
    expect(nextRoomNumber(held('BATHROOM', 1, 2), 'KITCHEN')).toBe(1);
  });
});

describe('room schemas', () => {
  it('tidies labels and treats blank as none', () => {
    expect(normalizeRoomLabel('  Ensuite ')).toBe('Ensuite');
    expect(normalizeRoomLabel('')).toBeNull();
    expect(createRoom.parse({ type: 'BEDROOM' })).toEqual({ type: 'BEDROOM', label: null });
    expect(createRoom.parse({ type: 'BEDROOM', label: ' ' })).toEqual({ type: 'BEDROOM', label: null });
  });

  it('requires a label for Other', () => {
    expect(createRoom.safeParse({ type: 'OTHER' }).success).toBe(false);
    expect(createRoom.safeParse({ type: 'OTHER', label: '  ' }).success).toBe(false);
    expect(createRoom.parse({ type: 'OTHER', label: 'Wine cellar' }).label).toBe('Wine cellar');
    expect(createRooms.safeParse({ rooms: [{ type: 'BEDROOM' }, { type: 'OTHER' }] }).success).toBe(false);
  });

  it('caps labels at 60 characters and updates carry only what was sent', () => {
    expect(createRoom.safeParse({ type: 'BEDROOM', label: 'x'.repeat(61) }).success).toBe(false);
    expect(updateRoom.parse({})).toEqual({});
    expect(updateRoom.parse({ label: null })).toEqual({ label: null });
  });
});
