import { addDays, addMonths, localDate } from './clock.js';

describe('clock helpers', () => {
  it('finds the local date in a time zone', () => {
    // 05:00 UTC on Nov 1 is still Oct 31 in Vancouver.
    expect(localDate('America/Vancouver', new Date('2026-11-01T05:00:00Z'))).toBe('2026-10-31');
    expect(localDate('UTC', new Date('2026-11-01T05:00:00Z'))).toBe('2026-11-01');
  });

  it('adds days and months across boundaries', () => {
    expect(addDays('2026-12-25', 14)).toBe('2027-01-08');
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-11', 2)).toBe('2027-01');
  });
});
