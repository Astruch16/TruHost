import { describe, expect, it } from 'vitest';
import { centsToInput, formatCents, parseDollarsToCents } from './money';

describe('parseDollarsToCents', () => {
  it.each([
    ['90', 9000],
    ['90.5', 9050],
    ['90.50', 9050],
    ['0.29', 29],
    ['$1,234.56', 123456],
    [' 12 ', 1200],
  ])('%s → %i', (input, cents) => {
    expect(parseDollarsToCents(input)).toBe(cents);
  });

  it.each(['', 'abc', '1.234', '-5', '1e3', '.5'])('rejects %j', (input) => {
    expect(parseDollarsToCents(input)).toBeNull();
  });
});

describe('formatting', () => {
  it('formats CAD', () => {
    expect(formatCents(123456)).toBe('$1,234.56');
  });
  it('round-trips through the input format', () => {
    for (const c of [0, 5, 29, 9050, 123456]) {
      expect(parseDollarsToCents(centsToInput(c))).toBe(c);
    }
  });
});
