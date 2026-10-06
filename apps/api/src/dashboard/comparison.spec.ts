import { comparisonBlocker, periodOf, pointChangeBps, relativeChangeBps } from './comparison.js';

describe('dashboard comparison', () => {
  it.each([
    [11_250, 10_000, 1_250],
    [9_000, 10_000, -1_000],
    [10_000, 10_000, 0],
    [1, 3, -6_667],
    [5, 0, null],
    [null, 10, null],
  ])('relative change %s vs %s = %s bps', (cur, prev, expected) => {
    expect(relativeChangeBps(cur, prev)).toBe(expected);
  });

  it('measures occupancy change in points', () => {
    expect(pointChangeBps(5_500, 6_000)).toBe(-500);
    expect(pointChangeBps(null, 6_000)).toBeNull();
  });

  it.each([
    ['2026-09', 'COMPLETE'],
    ['2026-10', 'MONTH_TO_DATE'],
    ['2026-11', 'UPCOMING'],
  ])('classifies %s on 2026-10-06 as %s', (month, period) => {
    expect(periodOf(month, '2026-10-06')).toBe(period);
  });

  it('applies the four conditions in order', () => {
    const ok = {
      propertyCount: 1,
      period: 'COMPLETE' as const,
      previousMonthAllPlanned: true,
      previousMonthIncomplete: 0,
    };
    expect(comparisonBlocker(ok)).toBeNull();
    expect(comparisonBlocker({ ...ok, propertyCount: 0 })).toBe('NO_PROPERTIES');
    expect(comparisonBlocker({ ...ok, period: 'MONTH_TO_DATE' })).toBe('MONTH_NOT_ENDED');
    expect(comparisonBlocker({ ...ok, period: 'UPCOMING' })).toBe('MONTH_NOT_ENDED');
    expect(comparisonBlocker({ ...ok, previousMonthAllPlanned: false })).toBe('NO_PLAN_IN_PREVIOUS_MONTH');
    expect(comparisonBlocker({ ...ok, previousMonthIncomplete: 2 })).toBe('PREVIOUS_MONTH_INCOMPLETE');
  });
});
