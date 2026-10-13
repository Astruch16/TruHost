import { describe, expect, it } from 'vitest';
import type { Property } from '@truhost/shared';
import { formatTime, myProperties, propertyFacts } from './my-properties';

describe('my properties', () => {
  it.each([
    ['16:00', '4 PM'],
    ['11:00', '11 AM'],
    ['10:30', '10:30 AM'],
    ['00:00', '12 AM'],
    ['12:15', '12:15 PM'],
  ])('formats %s as %s', (hhmm, text) => expect(formatTime(hhmm)).toBe(text));

  it.each<[string, Partial<Property>, string[]]>([
    [
      'everything entered',
      { bedrooms: 3, bathrooms: 2, halfBathrooms: 1, maxGuests: 6 },
      ['3 bedrooms', '2.5 baths', 'Sleeps 6'],
    ],
    [
      'a studio with one bath',
      { bedrooms: 0, bathrooms: 1, halfBathrooms: 0, maxGuests: 2 },
      ['Studio', '1 bath', 'Sleeps 2'],
    ],
    [
      'one bedroom, half bath only',
      { bedrooms: 1, bathrooms: null, halfBathrooms: 1, maxGuests: null },
      ['1 bedroom', '0.5 baths'],
    ],
    ['nothing entered yet', { bedrooms: null, bathrooms: null, halfBathrooms: null, maxGuests: null }, []],
  ])('facts: %s', (_case, layout, facts) =>
    expect(propertyFacts({ bedrooms: null, bathrooms: null, halfBathrooms: null, maxGuests: null, ...layout })).toEqual(
      facts,
    ),
  );

  it('keeps only the person’s properties, split by role, in list order with stable tints', () => {
    const p = (id: string) => ({ id }) as Property;
    const list = [p('a'), p('b'), p('c'), p('d')];
    const me = {
      memberships: [
        { id: 'm1', role: 'CLEANER' as const, property: { id: 'c', name: 'C' } },
        { id: 'm2', role: 'OWNER' as const, property: { id: 'a', name: 'A' } },
        { id: 'm3', role: 'OWNER' as const, property: { id: 'z', name: 'Archived' } },
      ],
    };
    const { owned, cleaned } = myProperties(me, list);
    expect(owned.map((x) => [x.property.id, x.index])).toEqual([['a', 0]]);
    expect(cleaned.map((x) => [x.property.id, x.index])).toEqual([['c', 2]]);
  });
});
