/**
 * Month-grid layout for the stays calendar. Pure: dates in, cells and bar segments out. A stay occupies its nights
 * (check-in through the day before check-out); its check-out day gets a "clean" marker.
 */

export interface CalendarStay {
  id: string;
  propertyId: string;
  kind: 'GUEST' | 'OWNER_STAY' | 'BLOCK';
  checkInDate: string;
  checkOutDate: string;
  nights: number;
}

export interface Segment {
  stay: CalendarStay;
  /** 0 = the first day of the week. */
  startCol: number;
  /** Inclusive. */
  endCol: number;
  lane: number;
  /** The bar continues from the previous week / into the next week. */
  continuesBefore: boolean;
  continuesAfter: boolean;
}

export interface Week {
  days: (string | null)[];
  segments: Segment[];
  lanes: number;
}

const DAY = 86_400_000;
const toDay = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / DAY;
const fromDay = (d: number) => new Date(d * DAY).toISOString().slice(0, 10);

export function monthGrid(month: string, stays: CalendarStay[], weekStartsOn: 0 | 1 = 0): Week[] {
  const first = toDay(`${month}-01`);
  const [y, m] = month.split('-').map(Number) as [number, number];
  const next = Date.UTC(y, m, 1) / DAY;
  const lead = (new Date(first * DAY).getUTCDay() - weekStartsOn + 7) % 7;
  const weeks: Week[] = [];

  for (let weekStart = first - lead; weekStart < next; weekStart += 7) {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = weekStart + i;
      return d >= first && d < next ? fromDay(d) : null;
    });
    // Nights shown: inside this week and inside the month.
    const lo = Math.max(weekStart, first);
    const hi = Math.min(weekStart + 7, next); // exclusive
    const placed: Segment[] = [];
    const laneEnds: number[] = [];
    const inWeek = stays
      .filter((s) => toDay(s.checkInDate) < hi && toDay(s.checkOutDate) > lo)
      .sort((a, b) => a.checkInDate.localeCompare(b.checkInDate) || a.id.localeCompare(b.id));
    for (const stay of inWeek) {
      const start = Math.max(toDay(stay.checkInDate), lo);
      const end = Math.min(toDay(stay.checkOutDate), hi) - 1; // last night shown
      let lane = laneEnds.findIndex((laneEnd) => laneEnd < start);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = end;
      placed.push({
        stay,
        startCol: start - weekStart,
        endCol: end - weekStart,
        lane,
        continuesBefore: toDay(stay.checkInDate) < start,
        continuesAfter: toDay(stay.checkOutDate) - 1 > end,
      });
    }
    weeks.push({ days, segments: placed, lanes: laneEnds.length });
  }
  return weeks;
}

/** Check-out dates in the month (cleans to schedule until Phase 3 cleans exist), with how many on each day. */
export function checkoutsByDay(month: string, stays: CalendarStay[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const s of stays) {
    if (s.kind === 'BLOCK' || !s.checkOutDate.startsWith(month)) continue;
    counts.set(s.checkOutDate, (counts.get(s.checkOutDate) ?? 0) + 1);
  }
  return counts;
}
