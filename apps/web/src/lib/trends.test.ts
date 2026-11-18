import { describe, expect, it } from 'vitest';
import { bestMonth, hasFigures, monthInitial, monthShort, niceScale, yearMonths, type TrendMonth } from './trends';

describe('the trends chart scale', () => {
  it.each([
    [[51_000, 102_000, 0], { min: 0, max: 120_000, step: 20_000 }],
    [[3, 9, 6], { min: 0, max: 10, step: 2 }],
    [[0, 0], { min: 0, max: 1, step: 1 }],
    [[4_200, -2_640], { min: -4_000, max: 6_000, step: 2_000 }],
    [[5_500], { min: 0, max: 6_000, step: 1_000 }],
  ])('%j → %j', (values, scale) => {
    expect(niceScale(values)).toEqual(scale);
  });

  it('names months short', () => {
    expect(monthShort('2026-01')).toBe('Jan');
    expect(monthShort('2026-11')).toBe('Nov');
  });
});

describe('the trend helpers', () => {
  const m = (month: string, period: TrendMonth['period'], grossCents: number, nightsBooked = 0) =>
    ({ month, period, grossCents, nightsBooked, stays: nightsBooked > 0 ? 1 : 0 }) as TrendMonth;

  it('finds the best month among those under way or ended, ignoring months to come', () => {
    const months = [m('2026-01', 'COMPLETE', 500), m('2026-02', 'MONTH_TO_DATE', 800), m('2026-03', 'UPCOMING', 9_000)];
    expect(bestMonth(months, (x) => x.grossCents)?.month).toBe('2026-02');
    expect(bestMonth([m('2026-01', 'COMPLETE', 0)], (x) => x.grossCents)).toBeNull();
  });

  it('knows a year with nothing in it', () => {
    expect(hasFigures([m('2024-01', 'COMPLETE', 0)])).toBe(false);
    expect(hasFigures([m('2024-01', 'COMPLETE', 0, 3)])).toBe(true);
  });

  it('lists a year’s months and letters them', () => {
    expect(yearMonths(2025)).toHaveLength(12);
    expect(yearMonths(2025)[11]).toBe('2025-12');
    expect(monthInitial('2026-09')).toBe('S');
  });
});
