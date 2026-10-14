import { describe, expect, it } from 'vitest';
import { filterCounts, initial, matchesFilter, stayPhase } from './bookings';

const TODAY = '2026-10-14';
const row = (
  checkInDate: string,
  checkOutDate: string,
  extra: Partial<{ kind: 'GUEST' | 'OWNER_STAY' | 'BLOCK'; status: 'CONFIRMED' | 'CANCELLED'; complete: boolean }> = {},
) => ({ kind: 'GUEST' as const, status: 'CONFIRMED' as const, complete: true, checkInDate, checkOutDate, ...extra });

describe('stayPhase', () => {
  it.each([
    ['2026-10-15', '2026-10-17', 'UPCOMING'],
    ['2026-10-14', '2026-10-16', 'IN_HOUSE'],
    ['2026-10-10', '2026-10-18', 'IN_HOUSE'],
    ['2026-10-10', '2026-10-14', 'CHECKED_OUT'],
  ] as const)('%s → %s is %s on Oct 14', (checkInDate, checkOutDate, phase) =>
    expect(stayPhase({ checkInDate, checkOutDate }, TODAY)).toBe(phase),
  );
});

describe('booking filters', () => {
  const rows = [
    row('2026-10-02', '2026-10-05'),
    row('2026-10-10', '2026-10-18', { complete: false }),
    row('2026-10-20', '2026-10-22', { complete: false }),
    row('2026-10-26', '2026-10-29', { kind: 'OWNER_STAY', complete: true }),
    row('2026-10-24', '2026-10-26', { status: 'CANCELLED', complete: false }),
  ];

  it('counts what each filter shows; cancelled stays only count as cancelled', () => {
    expect(filterCounts(rows, TODAY)).toEqual({
      ALL: 5,
      PENDING: 2,
      UPCOMING: 2,
      IN_HOUSE: 1,
      OWNER: 1,
      CANCELLED: 1,
    });
    expect(matchesFilter(rows[4]!, 'PENDING', TODAY)).toBe(false);
  });

  it('takes the first letter of a guest’s name for the avatar', () => {
    expect(initial(' andrew')).toBe('A');
    expect(initial(null)).toBe('?');
  });
});
