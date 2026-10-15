import { describe, expect, it } from 'vitest';
import { formatSigned, monthName, nextMonth, stayDates, stayNights } from './statements';

describe('statement display', () => {
  it.each([
    [-15_000, '−$150.00'],
    [4_250, '+$42.50'],
    [0, '$0.00'],
  ])('formats %i as %s', (cents, text) => expect(formatSigned(cents)).toBe(text));

  it('describes a stay’s nights, including the split across a month end', () => {
    expect(stayNights({ nights: 3, totalNights: 3, cancelled: false }, '2026-09')).toBe('3 nights');
    expect(stayNights({ nights: 1, totalNights: 1, cancelled: false }, '2026-09')).toBe('1 night');
    expect(stayNights({ nights: 2, totalNights: 5, cancelled: false }, '2026-09')).toBe('2 of 5 nights in September');
    expect(stayNights({ nights: 0, totalNights: 4, cancelled: true }, '2026-09')).toBe('Cancelled, paid out');
  });

  it('names dates and months', () => {
    expect(stayDates('2026-08-30', '2026-09-03')).toBe('Aug 30 – Sep 3');
    expect(monthName('2026-09')).toBe('September');
    expect(nextMonth('2026-12')).toBe('2027-01');
  });
});
