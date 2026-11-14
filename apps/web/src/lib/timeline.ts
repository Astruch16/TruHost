import type { CalendarStay } from './calendar';
import { addDays } from './dates';

/** How many days the dashboard's timeline shows, from today. */
export const TIMELINE_DAYS = 7;

/** One stay's bar on a property's row, in day columns (0 is the first day, 7 the end of the last). */
export interface TimelineBar {
  stay: CalendarStay;
  /** A stay runs from midday on its check-in day to midday on its check-out day, as on the month calendar. */
  from: number;
  to: number;
  /** It began before the first day shown / carries on after the last. */
  clippedStart: boolean;
  clippedEnd: boolean;
  /** Its row within the property's track (stays that overlap go on separate lanes). */
  lane: number;
}

/** The days shown, from `start`. */
export const timelineDays = (start: string, days = TIMELINE_DAYS) =>
  Array.from({ length: days }, (_, i) => addDays(start, i));

const dayIndex = (start: string, iso: string) => Math.round((Date.parse(iso) - Date.parse(start)) / 86_400_000);

/**
 * One property's row: its stays in the window as bars, and the days it needs a clean (a check-out, of a guest or an
 * owner, inside the window). Pure: stays and dates in, positions out.
 */
export function timelineRow(
  stays: readonly CalendarStay[],
  start: string,
  days = TIMELINE_DAYS,
): { bars: TimelineBar[]; cleans: number[]; lanes: number } {
  const bars: TimelineBar[] = [];
  const laneEnds: number[] = [];
  const inWindow = stays
    .filter((s) => dayIndex(start, s.checkOutDate) >= 0 && dayIndex(start, s.checkInDate) < days)
    .sort((a, b) => a.checkInDate.localeCompare(b.checkInDate));
  for (const stay of inWindow) {
    const checkIn = dayIndex(start, stay.checkInDate);
    const checkOut = dayIndex(start, stay.checkOutDate);
    const from = checkIn < 0 ? 0 : checkIn + 0.5;
    const to = checkOut >= days ? days : checkOut + 0.5;
    // Back-to-back stays share a day (one leaves at midday, the next arrives) and stay on the same lane.
    let lane = laneEnds.findIndex((end) => end <= from);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = to;
    bars.push({ stay, from, to, clippedStart: checkIn < 0, clippedEnd: checkOut >= days, lane });
  }
  const cleans = [
    ...new Set(
      inWindow
        .filter((s) => s.kind !== 'BLOCK')
        .map((s) => dayIndex(start, s.checkOutDate))
        .filter((d) => d >= 0 && d < days),
    ),
  ].sort((a, b) => a - b);
  return { bars, cleans, lanes: Math.max(1, laneEnds.length) };
}
