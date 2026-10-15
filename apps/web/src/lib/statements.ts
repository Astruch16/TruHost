import { formatCents } from './money';
import { addMonths, monthLabel, shortDate } from './months';
import type { PillTone } from './styles';

/**
 * Display helpers for owner statements. Every figure comes from the API (apps/api/src/reporting/statement.ts); these
 * only turn it into words.
 */

export type StatementState = 'NOT_STARTED' | 'DRAFT' | 'FINALIZED' | 'RELEASED';

export const STATE_LABEL: Record<StatementState, string> = {
  NOT_STARTED: 'Not started',
  DRAFT: 'Draft',
  FINALIZED: 'Finalized',
  RELEASED: 'Released',
};

export const STATE_TONE: Record<StatementState, PillTone> = {
  NOT_STARTED: 'neutral',
  DRAFT: 'lavender',
  FINALIZED: 'amber',
  RELEASED: 'sage',
};

/** Signed amounts as on a statement: "−$150.00" for deductions, "+$42.50" for credits, "$0.00" for zero. */
export function formatSigned(cents: number): string {
  if (cents === 0) return formatCents(0);
  return `${cents < 0 ? '−' : '+'}${formatCents(Math.abs(cents))}`;
}

/** "Sep 28 – Oct 3" for a stay (check-in to check-out). */
export function stayDates(checkIn: string, checkOut: string): string {
  return `${shortDate(checkIn)} – ${shortDate(checkOut)}`;
}

/** "September" from "2026-09". */
export function monthName(month: string): string {
  return monthLabel(month).split(' ')[0]!;
}

/**
 * How a stay's nights read on a statement: "3 nights", or "2 of 5 nights in September" when it crosses a month end,
 * or "Cancelled" (all of its payout lands in the check-in month).
 */
export function stayNights(
  line: { nights: number | null; totalNights: number | null; cancelled: boolean },
  month: string,
): string {
  if (line.cancelled) return 'Cancelled, paid out';
  const n = line.nights ?? 0;
  const total = line.totalNights ?? n;
  if (n === total) return `${n} night${n === 1 ? '' : 's'}`;
  return `${n} of ${total} nights in ${monthName(month)}`;
}

/** The statement a correction to `month` goes on. */
export const nextMonth = (month: string) => addMonths(month, 1);

/** "Oct 3" for an instant, in the viewer's time zone (when something was added or done). */
export function shortDay(isoDateTime: string): string {
  return new Date(isoDateTime).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}
