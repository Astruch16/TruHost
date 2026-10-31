import type { CleanStatus, CleanStep, CleanSummary } from '@truhost/shared';
import { dayLabel } from './dashboard-format';
import { addDays, weekColumn } from './dates';
import { formatTime } from './my-properties';
import type { PillTone } from './styles';

export const CLEAN_STATUS_TONE: Record<CleanStatus, PillTone> = {
  SCHEDULED: 'blue',
  IN_PROGRESS: 'amber',
  COMPLETE: 'sage',
  CANCELLED: 'neutral',
};

/** A clean's checklist steps, in the order they're worked. */
export const CLEAN_STEPS: CleanStep[] = ['BEFORE_PHOTOS', 'DAMAGE', 'STOCK_COUNT', 'AFTER_PHOTOS', 'FINISH'];

/** What each step asks for, in a line (the walkthrough before a clean starts). */
export const CLEAN_STEP_HINTS: Record<CleanStep, string> = {
  BEFORE_PHOTOS: 'Every room as you find it',
  DAMAGE: 'Anything broken or missing',
  STOCK_COUNT: 'How much of each supply is left',
  AFTER_PHOTOS: 'Every room, clean and ready',
  FINISH: 'TruHost and the owner are told',
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

/** A property's colour (its dot class, from PROPERTY_DOTS) as a CSS value, for the borders and tints a class can't give. */
export function propertyColorValue(dot: string | undefined): string {
  return dot ? `var(--color-${dot.replace(/^bg-/, '')})` : 'var(--color-line)';
}

/**
 * How a day with cleans is marked on the month: a ring in its properties' colours and a fill of the same, faint (a
 * share each, as slices, when it has cleans at more than one). Today keeps its solid green fill inside the ring, with a
 * white hairline between them.
 */
export function dayMarkStyle(
  colors: readonly string[],
  today = false,
): { border: string; background: string; boxShadow?: string } {
  const slices = (tint: boolean) =>
    `conic-gradient(${colors
      .map((c, i) => {
        const value = tint ? `color-mix(in srgb, ${c} 16%, transparent)` : c;
        return `${value} ${(i * 100) / colors.length}% ${((i + 1) * 100) / colors.length}%`;
      })
      .join(', ')})`;
  const solid = (c: string) => `linear-gradient(${c}, ${c})`;
  return {
    border: '2px solid transparent',
    background: [
      // The fill (over the card's white, so the ring's colour doesn't show through it), then the ring.
      ...(today
        ? [`${solid('var(--color-primary)')} padding-box`]
        : [`${slices(true)} padding-box`, `${solid('var(--color-surface)')} padding-box`]),
      `${slices(false)} border-box`,
    ].join(', '),
    // On today's dark fill a white hairline inside the ring keeps a green ring from melting into it.
    ...(today ? { boxShadow: 'inset 0 0 0 1.5px var(--color-surface)' } : {}),
  };
}

/** Each property's dot colour, assigned in name order so a property keeps its colour from visit to visit. */
export function propertyColors(properties: readonly { id: string; name: string }[]): Map<string, string> {
  const unique = [...new Map(properties.map((p) => [p.id, p])).values()].sort((a, b) => a.name.localeCompare(b.name));
  return new Map(unique.map((p, i) => [p.id, PROPERTY_DOTS[i % PROPERTY_DOTS.length]!]));
}

/** A list of cleans split by day, keeping their order: the agenda's date column beside each day's cleans. */
export function byDay<T extends Pick<CleanSummary, 'scheduledDate'>>(
  items: readonly T[],
): { day: string; items: T[] }[] {
  const days: { day: string; items: T[] }[] = [];
  for (const c of items) {
    const last = days.at(-1);
    if (last?.day === c.scheduledDate) last.items.push(c);
    else days.push({ day: c.scheduledDate, items: [c] });
  }
  return days;
}

/**
 * The hero's counts: cleans still to do the rest of this week and in the next 30 days (from today), and the properties
 * they're at. A clean still under way from an earlier day is still to do, so it counts (as it does in "today").
 */
export function scheduleCounts(
  items: readonly Pick<CleanSummary, 'scheduledDate' | 'status' | 'property'>[],
  today: string,
  weekStartsOn: 0 | 1,
): { thisWeek: number; next30: number; properties: number } {
  const live = items.filter(
    (c) => c.status === 'IN_PROGRESS' || (c.status === 'SCHEDULED' && c.scheduledDate >= today),
  );
  const weekEnd = addDays(today, 6 - weekColumn(today, weekStartsOn));
  const in30 = addDays(today, 30);
  return {
    thisWeek: live.filter((c) => c.scheduledDate <= weekEnd).length,
    next30: live.filter((c) => c.scheduledDate <= in30).length,
    properties: new Set(live.map((c) => c.property.id)).size,
  };
}

/** The first day of the week `day` falls in (the user's first day of the week), and that week's seven days. */
export function weekOf(day: string, weekStartsOn: 0 | 1): { start: string; days: string[] } {
  const start = addDays(day, -weekColumn(day, weekStartsOn));
  return { start, days: Array.from({ length: 7 }, (_, i) => addDays(start, i)) };
}

/**
 * For the side rail: each property with cleans ahead, its next clean and how many are coming (cancelled and done ones
 * left out), soonest first.
 */
export function propertySummaries<T extends Pick<CleanSummary, 'id' | 'scheduledDate' | 'status' | 'property'>>(
  items: readonly T[],
  today: string,
): { property: T['property']; next: T; upcoming: number }[] {
  const ahead = items
    .filter((c) => c.scheduledDate >= today && (c.status === 'SCHEDULED' || c.status === 'IN_PROGRESS'))
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  const out = new Map<string, { property: T['property']; next: T; upcoming: number }>();
  for (const c of ahead) {
    const found = out.get(c.property.id);
    if (found) found.upcoming++;
    else out.set(c.property.id, { property: c.property, next: c, upcoming: 1 });
  }
  return [...out.values()];
}
