/**
 * Month-grid layout for the stays calendar. Pure: dates in, cells and bar segments out. As on Airbnb and Vrbo, a stay's
 * bar runs from the middle of its check-in day to the middle of its check-out day, so back-to-back stays meet on the
 * turnover day; the check-out day also gets a "clean" marker.
 */

export type Channel = 'AIRBNB' | 'VRBO' | 'BOOKING_COM' | 'DIRECT' | 'OTHER';

export interface CalendarStay {
  id: string;
  propertyId: string;
  kind: 'GUEST' | 'OWNER_STAY' | 'BLOCK';
  /** Where the guest booked; picks the bar's colour for guest stays. */
  channel: Channel;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  /** Shown on the bar when known (admins). */
  guestName?: string | null;
}

export interface Segment {
  stay: CalendarStay;
  /** 0 = the first day of the week. */
  startCol: number;
  /** Inclusive. */
  endCol: number;
  /** Starts halfway through its first day (the check-in day is in this segment). */
  startsMidDay: boolean;
  /** Ends halfway through its last day (the check-out day is in this segment). */
  endsMidDay: boolean;
  lane: number;
  /** The bar continues from the previous week (or month) / into the next. */
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
    // Days shown: inside this week and inside the month.
    const lo = Math.max(weekStart, first);
    const last = Math.min(weekStart + 7, next) - 1; // inclusive
    const placed: Segment[] = [];
    // Lanes are filled in half-days, so a stay checking in on another's check-out day can share its lane.
    const laneEnds: number[] = [];
    const inWeek = stays
      .filter((s) => toDay(s.checkInDate) <= last && toDay(s.checkOutDate) >= lo)
      .sort((a, b) => a.checkInDate.localeCompare(b.checkInDate) || a.id.localeCompare(b.id));
    for (const stay of inWeek) {
      const checkIn = toDay(stay.checkInDate);
      const checkOut = toDay(stay.checkOutDate);
      const start = Math.max(checkIn, lo);
      const end = Math.min(checkOut, last);
      const startsMidDay = checkIn === start;
      const endsMidDay = checkOut === end;
      const fromHalf = 2 * start + (startsMidDay ? 1 : 0);
      const toHalf = 2 * end + (endsMidDay ? 1 : 2); // exclusive
      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= fromHalf);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = toHalf;
      placed.push({
        stay,
        startCol: start - weekStart,
        endCol: end - weekStart,
        startsMidDay,
        endsMidDay,
        lane,
        continuesBefore: checkIn < start,
        continuesAfter: checkOut > end,
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

/** How a stay looks on the calendar: guest stays by booking channel, owner stays and blocks by kind. */
export interface StayStyle {
  key: Channel | 'OWNER_STAY' | 'BLOCK';
  label: string;
  /** Classes for the bar (background and text). */
  bar: string;
  /** The calendar bar's outline colour (a border class), a darker shade of the bar. */
  edge: string;
  /** Classes for the legend swatch. */
  swatch: string;
}

const BLOCK_STRIPES = 'bg-[repeating-linear-gradient(135deg,var(--color-line-soft)_0_6px,var(--color-line)_6px_8px)]';

/** In legend order. */
export const STAY_STYLES: readonly StayStyle[] = [
  {
    key: 'AIRBNB',
    label: 'Airbnb',
    bar: 'bg-rose-tint text-rose-deep',
    edge: 'border-rose-deep/40',
    swatch: 'bg-rose-tint ring-1 ring-rose-deep/25',
  },
  {
    key: 'VRBO',
    label: 'Vrbo',
    bar: 'bg-blue-tint text-blue-deep',
    edge: 'border-blue-deep/40',
    swatch: 'bg-blue-tint ring-1 ring-blue-deep/25',
  },
  {
    key: 'BOOKING_COM',
    label: 'Booking.com',
    bar: 'bg-amber-tint text-amber-deep',
    edge: 'border-amber-deep/40',
    swatch: 'bg-amber-tint ring-1 ring-amber-deep/25',
  },
  {
    key: 'DIRECT',
    label: 'Direct',
    bar: 'bg-sage-tint text-sage-deep',
    edge: 'border-sage-deep/40',
    swatch: 'bg-sage-tint ring-1 ring-sage-deep/25',
  },
  {
    key: 'OTHER',
    label: 'Other channel',
    bar: 'bg-line text-ink',
    edge: 'border-ink/25',
    swatch: 'bg-line ring-1 ring-ink/15',
  },
  {
    key: 'OWNER_STAY',
    label: 'Owner stay',
    bar: 'bg-lavender-tint text-lavender-deep',
    edge: 'border-lavender-deep/40',
    swatch: 'bg-lavender-tint ring-1 ring-lavender-deep/25',
  },
  {
    key: 'BLOCK',
    label: 'Blocked',
    bar: `${BLOCK_STRIPES} text-muted`,
    edge: 'border-ink/25',
    swatch: `${BLOCK_STRIPES} ring-1 ring-ink/15`,
  },
];

const BY_KEY = new Map(STAY_STYLES.map((s) => [s.key, s]));

export function stayStyle(stay: Pick<CalendarStay, 'kind' | 'channel'>): StayStyle {
  return BY_KEY.get(stay.kind === 'GUEST' ? stay.channel : stay.kind) ?? BY_KEY.get('OTHER')!;
}

/**
 * The legend for a month: only the colours of stays that show in it (any part of a bar), in legend order, so it
 * never lists channels that aren't on the calendar. `cleans` says whether any check-out falls in the month.
 */
export function monthLegend(month: string, stays: readonly CalendarStay[]): { styles: StayStyle[]; cleans: boolean } {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const first = `${month}-01`;
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const shown = new Set(
    // On the calendar: checks in by the month's end, checks out on or after its first day (half a day shows).
    stays.filter((s) => s.checkInDate < next && s.checkOutDate >= first).map((s) => stayStyle(s).key),
  );
  return {
    styles: STAY_STYLES.filter((s) => shown.has(s.key)),
    cleans: checkoutsByDay(month, stays as CalendarStay[]).size > 0,
  };
}

/** A bar's words: "Andrew · 8 nights", "8 nights" (no name), "Owner stay" or "Blocked". */
export function stayLabel(stay: Pick<CalendarStay, 'kind' | 'nights' | 'guestName'>): string {
  if (stay.kind === 'OWNER_STAY') return 'Owner stay';
  if (stay.kind === 'BLOCK') return 'Blocked';
  const nights = `${stay.nights} night${stay.nights === 1 ? '' : 's'}`;
  const name = stay.guestName?.trim();
  return name ? `${name} · ${nights}` : nights;
}

export interface AgendaEvent {
  type: 'CHECK_IN' | 'CHECK_OUT';
  stay: CalendarStay;
}

/**
 * The month's arrivals and departures by day, earliest first. On a turnover day the check-out comes first, as the day
 * runs. Blocks have neither (nobody comes or goes).
 */
export function monthAgenda(month: string, stays: readonly CalendarStay[]): { date: string; events: AgendaEvent[] }[] {
  const byDay = new Map<string, AgendaEvent[]>();
  const add = (date: string, event: AgendaEvent) => {
    if (!date.startsWith(month)) return;
    byDay.set(date, [...(byDay.get(date) ?? []), event]);
  };
  for (const stay of stays) {
    if (stay.kind === 'BLOCK') continue;
    add(stay.checkInDate, { type: 'CHECK_IN', stay });
    add(stay.checkOutDate, { type: 'CHECK_OUT', stay });
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, events]) => ({
      date,
      events: events.sort((a, b) => (a.type === b.type ? 0 : a.type === 'CHECK_OUT' ? -1 : 1)),
    }));
}

/** The first date on or after `from` with an event of this type, or null. */
export function nextEvent(
  agenda: readonly { date: string; events: AgendaEvent[] }[],
  type: AgendaEvent['type'],
  from: string,
): string | null {
  return agenda.find((d) => d.date >= from && d.events.some((e) => e.type === type))?.date ?? null;
}
