/** Change helpers for "vs. previous month". Display metrics, not money: they never feed a calculation. */

/** Relative change in basis points of the previous value (1250 = +12.5%); null when there's nothing to compare. */
export function relativeChangeBps(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return Math.round(((current - previous) * 10_000) / previous);
}

/** Difference in basis points between two rates (occupancy 6000 → 5500 is −500, i.e. −5 points). */
export function pointChangeBps(current: number | null, previous: number | null): number | null {
  return current === null || previous === null ? null : current - previous;
}

export type Period = 'COMPLETE' | 'MONTH_TO_DATE' | 'UPCOMING';

export function periodOf(month: string, today: string): Period {
  const current = today.slice(0, 7);
  return month < current ? 'COMPLETE' : month === current ? 'MONTH_TO_DATE' : 'UPCOMING';
}

/**
 * Whether "vs. previous month" may be shown (approved 2026-10-06): the viewed month has ended, and so has the
 * previous one; every property in scope had a plan in force for the whole previous month; and the previous month
 * has no stays waiting on a payout. Plans start on the 1st, so "in force on the 1st" means "for the whole month".
 */
export function comparisonBlocker(input: {
  propertyCount: number;
  period: Period;
  previousMonthAllPlanned: boolean;
  previousMonthIncomplete: number;
}): 'NO_PROPERTIES' | 'MONTH_NOT_ENDED' | 'NO_PLAN_IN_PREVIOUS_MONTH' | 'PREVIOUS_MONTH_INCOMPLETE' | null {
  if (input.propertyCount === 0) return 'NO_PROPERTIES';
  if (input.period !== 'COMPLETE') return 'MONTH_NOT_ENDED';
  if (!input.previousMonthAllPlanned) return 'NO_PLAN_IN_PREVIOUS_MONTH';
  if (input.previousMonthIncomplete > 0) return 'PREVIOUS_MONTH_INCOMPLETE';
  return null;
}
