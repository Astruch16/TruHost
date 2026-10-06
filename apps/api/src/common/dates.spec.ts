import { currentMonthStart, fromIsoDate, toIsoDate } from './dates.js';

describe('dates', () => {
  it('round-trips calendar dates without timezone drift', () => {
    expect(toIsoDate(fromIsoDate('2026-03-08'))).toBe('2026-03-08');
    expect(toIsoDate(null)).toBeNull();
  });

  it('computes the current month in the property time zone', () => {
    // 2026-11-01 05:00 UTC is still Oct 31 in Vancouver.
    const instant = new Date('2026-11-01T05:00:00Z');
    expect(currentMonthStart('America/Vancouver', instant)).toBe('2026-10-01');
    expect(currentMonthStart('UTC', instant)).toBe('2026-11-01');
  });
});
