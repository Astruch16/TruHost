import type { CleanStatus, CleanSummary } from '@truhost/shared';
import { dayLabel } from './dashboard-format';
import { addDays, weekColumn } from './dates';
import { monthLabel } from './months';
import { formatTime } from './my-properties';
import type { PillTone } from './styles';

export const CLEAN_STATUS_TONE: Record<CleanStatus, PillTone> = {
  SCHEDULED: 'blue',
  IN_PROGRESS: 'amber',
  COMPLETE: 'sage',
  CANCELLED: 'neutral',
};

/** What the clean follows: "After a guest stay", "After an owner stay", or an ad-hoc clean. */
export function cleanOccasion(c: Pick<CleanSummary, 'kind' | 'stay'>): string {
  if (c.kind === 'ADHOC' || !c.stay) return 'Extra clean';
  return c.stay.kind === 'OWNER_STAY' ? 'After an owner stay' : 'After a guest stay';
}

/** "Free from 11 AM" (the stay's check-out), or null for an ad-hoc clean with no set start. */
export function freeFrom(c: Pick<CleanSummary, 'window'>): string | null {
  return c.window.from.time ? `Free from ${formatTime(c.window.from.time)}` : null;
}

/**
 * When it must be done: "Ready by 4 PM" when the next guests arrive the same day, "Ready by 4 PM Sat, Nov 21" on a
 * later day, or "No one arriving after" when nothing is booked.
 */
export function readyBy(c: Pick<CleanSummary, 'window' | 'scheduledDate'>): string {
  const until = c.window.until;
  if (!until) return 'No one arriving after';
  const time = until.time ? formatTime(until.time) : 'check-in';
  return until.date === c.scheduledDate ? `Ready by ${time}` : `Ready by ${time} ${dayLabel(until.date)}`;
}

/**
 * A cleaner's schedule around `today`: today's cleans (and any left under way from an earlier day), what's coming
 * up (cancelled ones included, so a cleaner sees the change), and the last few done, newest first.
 */
export function scheduleGroups<T extends Pick<CleanSummary, 'id' | 'status' | 'scheduledDate' | 'completedAt'>>(
  items: readonly T[],
  today: string,
): { today: T[]; upcoming: T[]; recent: T[] } {
  const now: T[] = [];
  const upcoming: T[] = [];
  const recent: T[] = [];
  for (const c of items) {
    if (c.status === 'IN_PROGRESS' || (c.scheduledDate === today && c.status !== 'CANCELLED')) now.push(c);
    else if (c.scheduledDate > today) upcoming.push(c);
    else if (c.status === 'COMPLETE') recent.push(c);
  }
  const byDay = (a: T, b: T) => a.scheduledDate.localeCompare(b.scheduledDate);
  return {
    today: now.sort(byDay),
    upcoming: upcoming.sort(byDay),
    recent: recent.sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate)).slice(0, 5),
  };
}

/** Dot colours for properties on the schedule's calendar, in a fixed order. */
export const PROPERTY_DOTS = [
  'bg-sage-mid',
  'bg-blue-deep',
  'bg-amber-mid',
  'bg-lavender-deep',
  'bg-rose-deep',
] as const;

/** Each property's dot colour, assigned in name order so a property keeps its colour from visit to visit. */
export function propertyColors(properties: readonly { id: string; name: string }[]): Map<string, string> {
  const unique = [...new Map(properties.map((p) => [p.id, p])).values()].sort((a, b) => a.name.localeCompare(b.name));
  return new Map(unique.map((p, i) => [p.id, PROPERTY_DOTS[i % PROPERTY_DOTS.length]!]));
}

export type ScheduleSort = 'soonest' | 'latest';

/**
 * Coming-up cleans in groups a cleaner plans by: this week, next week, then by month ("Later in November",
 * "December"), in the chosen order. Weeks start on the user's first day of the week.
 */
export function weekGroups<T extends Pick<CleanSummary, 'scheduledDate'>>(
  items: readonly T[],
  today: string,
  weekStartsOn: 0 | 1,
  sort: ScheduleSort = 'soonest',
): { label: string; items: T[] }[] {
  const startOfWeek = addDays(today, -weekColumn(today, weekStartsOn));
  const nextWeek = addDays(startOfWeek, 7);
  const after = addDays(startOfWeek, 14);
  const label = (d: string) => {
    if (d < nextWeek) return 'This week';
    if (d < after) return 'Next week';
    const month = monthLabel(d.slice(0, 7)).split(' ')[0];
    return d.slice(0, 7) === after.slice(0, 7) ? `Later in ${month}` : monthLabel(d.slice(0, 7));
  };
  const sorted = [...items].sort((a, b) =>
    sort === 'soonest'
      ? a.scheduledDate.localeCompare(b.scheduledDate)
      : b.scheduledDate.localeCompare(a.scheduledDate),
  );
  const groups: { label: string; items: T[] }[] = [];
  for (const c of sorted) {
    const l = label(c.scheduledDate);
    const last = groups.at(-1);
    if (last?.label === l) last.items.push(c);
    else groups.push({ label: l, items: [c] });
  }
  return groups;
}
