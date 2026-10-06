import { describe, expect, it } from 'vitest';
import { dayLabel, formatChange, formatPoints, greeting, monogram } from './dashboard-format';

describe('dashboard formatting', () => {
  it.each([
    [7000, '+70%'],
    [1250, '+13%'], // whole percent from 10% up
    [950, '+9.5%'], // one decimal under 10%
    [-800, '−8%'],
    [-6667, '−67%'],
    [0, '±0%'],
  ])('formatChange(%i) = %s', (bps, expected) => expect(formatChange(bps)).toBe(expected));

  it('formats points and labels', () => {
    expect(formatPoints(32)).toBe('+0.3 pts');
    expect(formatPoints(-500)).toBe('−5 pts');
    expect(greeting(9)).toBe('Good morning');
    expect(greeting(13)).toBe('Good afternoon');
    expect(greeting(20)).toBe('Good evening');
    expect(dayLabel('2026-11-21')).toBe('Sat, Nov 21');
    expect(monogram('Cedar Suite')).toBe('CS');
    expect(monogram('Loft')).toBe('LO');
  });
});
