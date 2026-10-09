import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonthsToDate,
  calendarDays,
  clampDate,
  formatDate,
  formatDateLong,
  moveFocus,
  nightsBetween,
  todayIso,
} from './dates';

describe('dates', () => {
  it('adds days across month and year ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it.each([
    ['2026-01-31', 1, '2026-02-28'],
    ['2028-01-31', 1, '2028-02-29'],
    ['2026-10-08', -1, '2026-09-08'],
    ['2026-12-15', 1, '2027-01-15'],
    ['2026-03-31', -12, '2025-03-31'],
  ])('%s + %i months → %s', (iso, months, expected) => {
    expect(addMonthsToDate(iso, months)).toBe(expected);
  });

  it('lays out six whole weeks, Sunday first', () => {
    const oct = calendarDays('2026-10'); // Oct 1, 2026 is a Thursday
    expect(oct).toHaveLength(42);
    expect(oct[0]).toBe('2026-09-27');
    expect(oct[4]).toBe('2026-10-01');
    expect(oct[41]).toBe('2026-11-07');
    expect(calendarDays('2026-02')[0]).toBe('2026-02-01'); // Feb 1, 2026 is a Sunday
  });

  it.each([
    ['ArrowRight', false, '2026-10-09'],
    ['ArrowLeft', false, '2026-10-07'],
    ['ArrowDown', false, '2026-10-15'],
    ['ArrowUp', false, '2026-10-01'],
    ['Home', false, '2026-10-04'],
    ['End', false, '2026-10-10'],
    ['PageDown', false, '2026-11-08'],
    ['PageUp', true, '2025-10-08'],
    ['Tab', false, null],
  ])('%s (shift %s) from Thu Oct 8 → %s', (key, shift, expected) => {
    expect(moveFocus('2026-10-08', key, shift)).toBe(expected);
  });

  it('clamps to bounds', () => {
    expect(clampDate('2026-10-01', '2026-10-05')).toBe('2026-10-05');
    expect(clampDate('2026-10-20', undefined, '2026-10-10')).toBe('2026-10-10');
    expect(clampDate('2026-10-08', '2026-10-01', '2026-10-31')).toBe('2026-10-08');
  });

  it('formats for the button and for screen readers, without shifting the day', () => {
    expect(formatDate('2026-10-08')).toBe('Thu, Oct 8, 2026');
    expect(formatDateLong('2026-10-08')).toBe('Thursday, October 8, 2026');
    expect(nightsBetween('2026-10-08', '2026-10-11')).toBe(3);
  });

  it('takes today from the browser’s own clock', () => {
    expect(todayIso(new Date(2026, 9, 8, 23, 30))).toBe('2026-10-08');
  });
});
