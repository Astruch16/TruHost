/**
 * Calendar-date helpers for the date and month pickers. Dates are "YYYY-MM-DD" and months "YYYY-MM" (calendar
 * values, no time zone), computed in UTC so they never shift with the browser's zone.
 */
const DAY = 86_400_000;
const parse = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const format = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function addDays(iso: string, days: number): string {
  return format(parse(iso) + days * DAY);
}

/** The same day `months` later, clamped to the end of shorter months (Jan 31 + 1 month → Feb 28/29). */
export function addMonthsToDate(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return format(target.getTime());
}

/** Today in the browser's own time zone, as a calendar date. */
export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const monthOf = (iso: string) => iso.slice(0, 7);

/** 0 = Sunday. */
export const weekday = (iso: string) => new Date(parse(iso)).getUTCDay();

/**
 * The days shown for a month: whole weeks, Sunday first, always six of them (42 days) so the panel never changes
 * height between months.
 */
export function calendarDays(month: string): string[] {
  const first = `${month}-01`;
  const start = addDays(first, -weekday(first));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** Where a key press moves the focused day in a calendar grid, or null for keys it doesn't handle. */
export function moveFocus(iso: string, key: string, shift = false): string | null {
  switch (key) {
    case 'ArrowLeft':
      return addDays(iso, -1);
    case 'ArrowRight':
      return addDays(iso, 1);
    case 'ArrowUp':
      return addDays(iso, -7);
    case 'ArrowDown':
      return addDays(iso, 7);
    case 'Home':
      return addDays(iso, -weekday(iso));
    case 'End':
      return addDays(iso, 6 - weekday(iso));
    case 'PageUp':
      return addMonthsToDate(iso, shift ? -12 : -1);
    case 'PageDown':
      return addMonthsToDate(iso, shift ? 12 : 1);
    default:
      return null;
  }
}

/** Keeps a date within optional bounds (inclusive). */
export function clampDate(iso: string, min?: string, max?: string): string {
  if (min && iso < min) return min;
  if (max && iso > max) return max;
  return iso;
}

const longFormat = new Intl.DateTimeFormat('en-CA', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});
const fullFormat = new Intl.DateTimeFormat('en-CA', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "Thu, Oct 8, 2026": how a chosen date reads on the picker's button. */
export const formatDate = (iso: string) => longFormat.format(parse(iso));
/** "Thursday, October 8, 2026": what screen readers hear for each day. */
export const formatDateLong = (iso: string) => fullFormat.format(parse(iso));

/** Whole nights between two dates (check-out − check-in). */
export const nightsBetween = (from: string, to: string) => Math.round((parse(to) - parse(from)) / DAY);
