import { describe, expect, it } from 'vitest';
import { monthGrid } from './calendar';
import { calendarDays, moveFocus, weekColumn } from './dates';
import { weekdayNames } from './preferences';

// October 2026 starts on a Thursday.
describe('week start (Settings → Preferences)', () => {
  it('starts the date picker grid on Sunday or Monday', () => {
    expect(calendarDays('2026-10')[0]).toBe('2026-09-27'); // Sunday
    expect(calendarDays('2026-10', 1)[0]).toBe('2026-09-28'); // Monday
    expect(calendarDays('2026-10', 1)).toHaveLength(42);
    // A month starting on the week's first day starts in the first cell.
    expect(calendarDays('2026-06', 1)[0]).toBe('2026-06-01'); // Mon Jun 1
    expect(calendarDays('2026-11')[0]).toBe('2026-11-01'); // Sun Nov 1
  });

  it('places days in columns and moves Home/End to the week’s ends', () => {
    expect(weekColumn('2026-10-11', 0)).toBe(0); // Sunday
    expect(weekColumn('2026-10-11', 1)).toBe(6);
    expect(moveFocus('2026-10-08', 'Home', false, 1)).toBe('2026-10-05');
    expect(moveFocus('2026-10-08', 'End', false, 1)).toBe('2026-10-11');
    expect(moveFocus('2026-10-08', 'Home')).toBe('2026-10-04');
  });

  it('lays out the stays calendar from the chosen first day', () => {
    const sunday = monthGrid('2026-10', []);
    const monday = monthGrid('2026-10', [], 1);
    expect(sunday[0]!.days.indexOf('2026-10-01')).toBe(4);
    expect(monday[0]!.days.indexOf('2026-10-01')).toBe(3);
    expect(monday.at(-1)!.days.includes('2026-10-31')).toBe(true);
    // A stay over the weekend is one bar when weeks start on Monday, two when they start on Sunday.
    const weekend = [
      {
        id: 's',
        propertyId: 'a',
        kind: 'GUEST' as const,
        checkInDate: '2026-10-10',
        checkOutDate: '2026-10-12',
        nights: 2,
      },
    ];
    expect(monthGrid('2026-10', weekend).flatMap((w) => w.segments)).toHaveLength(2);
    expect(monthGrid('2026-10', weekend, 1).flatMap((w) => w.segments)).toEqual([
      expect.objectContaining({ startCol: 5, endCol: 6, continuesBefore: false, continuesAfter: false }),
    ]);
  });

  it('names the days in column order', () => {
    expect(weekdayNames(0)[0]).toBe('Sunday');
    expect(weekdayNames(1)).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
  });
});
