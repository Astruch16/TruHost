import { describe, expect, it } from 'vitest';
import { checkoutsByDay, monthGrid, type CalendarStay } from './calendar';

const stay = (id: string, checkInDate: string, checkOutDate: string, propertyId = 'a'): CalendarStay => ({
  id,
  propertyId,
  kind: 'GUEST',
  channel: 'AIRBNB',
  checkInDate,
  checkOutDate,
  nights: 0,
});

describe('monthGrid', () => {
  it('lays out October 2026 (starts Thursday, 5 weeks)', () => {
    const weeks = monthGrid('2026-10', []);
    expect(weeks).toHaveLength(5);
    expect(weeks[0]!.days).toEqual([null, null, null, null, '2026-10-01', '2026-10-02', '2026-10-03']);
    expect(weeks[4]!.days).toEqual([
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
    ]);
  });

  it('runs a stay from mid check-in day to mid check-out day, breaking at week edges', () => {
    // Oct 8 (Thu) → Oct 12 (Mon): from the middle of Thu to Sat | from Sun to the middle of Mon.
    const weeks = monthGrid('2026-10', [stay('s', '2026-10-08', '2026-10-12')]);
    expect(weeks[1]!.segments).toMatchObject([
      { startCol: 4, endCol: 6, startsMidDay: true, endsMidDay: false, continuesBefore: false, continuesAfter: true },
    ]);
    expect(weeks[2]!.segments).toMatchObject([
      { startCol: 0, endCol: 1, startsMidDay: false, endsMidDay: true, continuesBefore: true, continuesAfter: false },
    ]);
  });

  it('clips stays to the month, showing half a day at either end', () => {
    // From September: starts at Oct 1's left edge, ends mid Oct 3.
    expect(monthGrid('2026-10', [stay('s', '2026-09-29', '2026-10-03')])[0]!.segments).toMatchObject([
      { startCol: 4, endCol: 6, startsMidDay: false, endsMidDay: true, continuesBefore: true },
    ]);
    // Checking out on Oct 1: just the left half of Oct 1.
    expect(monthGrid('2026-10', [stay('s', '2026-09-28', '2026-10-01')])[0]!.segments).toMatchObject([
      { startCol: 4, endCol: 4, startsMidDay: false, endsMidDay: true, continuesBefore: true, continuesAfter: false },
    ]);
    // Checking in on Oct 31: just the right half of Oct 31, running on into November.
    expect(monthGrid('2026-10', [stay('s', '2026-10-31', '2026-11-03')])[4]!.segments).toMatchObject([
      { startCol: 6, endCol: 6, startsMidDay: true, endsMidDay: false, continuesBefore: false, continuesAfter: true },
    ]);
  });

  it('stacks overlapping stays into lanes and reuses freed lanes', () => {
    const weeks = monthGrid('2026-10', [
      stay('a', '2026-10-11', '2026-10-14', 'p1'),
      stay('b', '2026-10-12', '2026-10-13', 'p2'),
      stay('c', '2026-10-14', '2026-10-16', 'p1'), // same-day turnover after a: shares Oct 14, reuses lane 0
      stay('d', '2026-10-13', '2026-10-15', 'p3'), // overlaps a's last half-day and c's first: a new lane
    ]);
    const lanes = Object.fromEntries(weeks[2]!.segments.map((s) => [s.stay.id, s.lane]));
    expect(lanes).toEqual({ a: 0, b: 1, c: 0, d: 1 });
    expect(weeks[2]!.lanes).toBe(2);
  });
});

describe('checkoutsByDay', () => {
  it('counts check-outs in the month, ignoring blocks', () => {
    const counts = checkoutsByDay('2026-10', [
      stay('a', '2026-10-01', '2026-10-04'),
      stay('b', '2026-10-02', '2026-10-04', 'p2'),
      stay('c', '2026-10-30', '2026-11-02'),
      { ...stay('d', '2026-10-05', '2026-10-07'), kind: 'BLOCK' },
    ]);
    expect([...counts]).toEqual([['2026-10-04', 2]]);
  });
});
