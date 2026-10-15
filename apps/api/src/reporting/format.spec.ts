import { formatBps, formatCad, formatDate, formatDay } from './format.js';

describe('document formatting', () => {
  it.each([
    [0, '$0.00'],
    [5, '$0.05'],
    [123_456, '$1,234.56'],
    [100_000_000, '$1,000,000.00'],
    [-2_500, '−$25.00'],
  ])('formatCad(%i) = %s', (cents, text) => expect(formatCad(cents)).toBe(text));

  it.each([
    [2200, '22%'],
    [1850, '18.5%'],
    [1825, '18.25%'],
    [0, '0%'],
  ])('formatBps(%i) = %s', (bps, text) => expect(formatBps(bps)).toBe(text));

  it('writes dates in words', () => {
    expect(formatDate('2026-09-28')).toBe('Sep 28, 2026');
    expect(formatDay('2026-10-03')).toBe('Oct 3');
  });
});
