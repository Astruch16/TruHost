import { describe, expect, it } from 'vitest';
import type { CalendarStay } from './calendar';
import { timelineDays, timelineRow } from './timeline';

const stay = (id: string, checkInDate: string, checkOutDate: string, kind: CalendarStay['kind'] = 'GUEST') =>
  ({ id, propertyId: 'p1', kind, channel: 'AIRBNB', checkInDate, checkOutDate, nights: 1 }) as CalendarStay;

describe('the next-7-days timeline', () => {
  it('shows seven days from today', () => {
    expect(timelineDays('2026-11-13')).toEqual([
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
    ]);
  });

  it('runs each stay from midday to midday, clipped at the edges, with a clean on each check-out', () => {
    const { bars, cleans, lanes } = timelineRow(
      [
        stay('before', '2026-11-10', '2026-11-14'),
        stay('inside', '2026-11-14', '2026-11-17'),
        stay('after', '2026-11-18', '2026-11-25', 'OWNER_STAY'),
        stay('gone', '2026-11-01', '2026-11-12'),
        stay('later', '2026-11-20', '2026-11-22'),
      ],
      '2026-11-13',
    );
    expect(bars.map((b) => [b.stay.id, b.from, b.to, b.clippedStart, b.clippedEnd, b.lane])).toEqual([
      ['before', 0, 1.5, true, false, 0],
      // Arrives the day the previous guest leaves: same lane.
      ['inside', 1.5, 4.5, false, false, 0],
      ['after', 5.5, 7, false, true, 0],
    ]);
    expect(cleans).toEqual([1, 4]);
    expect(lanes).toBe(1);
  });

  it('puts overlapping stays on separate lanes, and blocks need no clean', () => {
    const { bars, cleans, lanes } = timelineRow(
      [stay('a', '2026-11-13', '2026-11-16'), stay('b', '2026-11-14', '2026-11-15', 'BLOCK')],
      '2026-11-13',
    );
    expect(bars.map((b) => b.lane)).toEqual([0, 1]);
    expect(lanes).toBe(2);
    expect(cleans).toEqual([3]);
  });
});
