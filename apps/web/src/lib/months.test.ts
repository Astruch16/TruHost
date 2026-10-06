import { describe, expect, it } from 'vitest';
import { addMonths, monthLabel, monthRange, shortDate } from './months';

describe('months', () => {
  it('steps across year boundaries', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-10', 0)).toBe('2026-10');
  });
  it('builds half-open ranges', () => {
    expect(monthRange('2026-12')).toEqual({ from: '2026-12-01', to: '2027-01-01' });
  });
  it('labels without time-zone drift', () => {
    expect(monthLabel('2026-10')).toBe('October 2026');
    expect(shortDate('2026-11-01')).toBe('Nov 1');
  });
});
