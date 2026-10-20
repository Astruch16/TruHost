import type { CleanStatus, CleanSummary } from '@truhost/shared';
import { dayLabel } from './dashboard-format';
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
