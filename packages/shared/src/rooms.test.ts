import { describe, expect, it } from 'vitest';
import { createRoom, createRooms, updateRoom } from './api/properties.js';
import type { RoomType } from './enums.js';
import { duplicateRoomName, normalizeRoomLabel, roomDisplayNames } from './rooms.js';

const names = (rooms: [RoomType, string | null][]) => [
  ...roomDisplayNames(rooms.map(([type, label], i) => ({ id: String(i), type, label }))).values(),
];

describe('room display names', () => {
  it.each<[string, [RoomType, string | null][], string[]]>([
    ['the only room of its type is just the type', [['KITCHEN', null]], ['Kitchen']],
    [
      'several unlabelled rooms of a type are numbered in walkthrough order',
      [
        ['BEDROOM', null],
        ['KITCHEN', null],
        ['BEDROOM', null],
      ],
      ['Bedroom 1', 'Kitchen', 'Bedroom 2'],
    ],
    ['a label is shown after the type', [['BEDROOM', 'Primary']], ['Bedroom · Primary']],
    [
      'numbers count every room of the type, labelled or not',
      [
        ['BEDROOM', 'Primary'],
        ['BEDROOM', null],
        ['BEDROOM', null],
      ],
      ['Bedroom · Primary', 'Bedroom 2', 'Bedroom 3'],
    ],
    [
      'one labelled and one unlabelled of a type',
      [
        ['BATHROOM', null],
        ['BATHROOM', 'Ensuite'],
      ],
      ['Bathroom 1', 'Bathroom · Ensuite'],
    ],
    [
      'types with spaces and Other',
      [
        ['HALF_BATH', null],
        ['PATIO_DECK', null],
        ['OTHER', 'Wine cellar'],
        ['LIVING', 'Loft'],
      ],
      ['Half bath', 'Patio/Deck', 'Other · Wine cellar', 'Living room · Loft'],
    ],
    ['labels are tidied', [['BEDROOM', '  Kids   room ']], ['Bedroom · Kids room']],
    ['an empty label counts as none', [['BEDROOM', '   ']], ['Bedroom']],
  ])('%s', (_case, rooms, expected) => expect(names(rooms)).toEqual(expected));

  it('finds two rooms that would share a name, ignoring case', () => {
    expect(
      duplicateRoomName(
        names([
          ['BEDROOM', 'Primary'],
          ['BEDROOM', 'primary'],
        ]),
      ),
    ).toBe('Bedroom · primary');
    expect(
      duplicateRoomName(
        names([
          ['BEDROOM', null],
          ['BEDROOM', null],
          ['BEDROOM', 'Loft'],
        ]),
      ),
    ).toBeNull();
    // A label that looks like a number never collides with a numbered room ("Bedroom · 2" vs "Bedroom 2").
    expect(
      duplicateRoomName(
        names([
          ['BEDROOM', null],
          ['BEDROOM', null],
          ['BEDROOM', '2'],
        ]),
      ),
    ).toBeNull();
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
