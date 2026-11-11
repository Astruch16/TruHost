import { describe, expect, it } from 'vitest';
import { dayLabel, feeNote, formatChange, formatPoints, greeting, monogram } from './dashboard-format';

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

describe('the management fee’s note', () => {
  const p = (name: string, feeRateBps: number | null) => ({ name, feeRateBps });
  it.each([
    [[p('A', 2200)], '22% of gross'],
    [[p('A', 0)], 'Owner-managed (0%)'],
    [[p('A', null)], 'No plan in force'],
    [[p('A', 2200), p('B', 2200), p('C', 2200)], '22% on 3 properties'],
    [[p('A', 2200), p('B', 0), p('C', 2200)], '22% on 2 properties · B owner-managed (0%)'],
    [[p('A', 2200), p('B', 0), p('C', 0)], '22% on 1 property · B and C owner-managed (0%)'],
    [[p('A', 2200), p('B', 1800), p('C', null)], '22% on 1 property · 18% on 1 property · C: no plan'],
  ])('%j reads “%s”', (properties, note) => {
    expect(feeNote(properties)).toBe(note);
  });
});
