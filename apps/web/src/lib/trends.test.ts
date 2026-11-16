import { describe, expect, it } from 'vitest';
import { monthShort, niceScale } from './trends';

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
