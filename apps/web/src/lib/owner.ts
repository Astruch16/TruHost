import { formatCents } from './money';
import { monthLabel } from './months';

/**
 * Display helpers for the owner portal. Every figure comes from the API (released statement copies or the reporting
 * functions); these only put it into words or screen proportions.
 */

/** "Good morning" / "Good afternoon" / "Good evening" for the viewer's local time. */
export function greeting(now = new Date()): string {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/** "September" from "2026-09". */
export const monthOnly = (month: string) => monthLabel(month).split(' ')[0]!;

/** "Sep" from "2026-09". */
export const monthShort = (month: string) => monthOnly(month).slice(0, 3);

/** "+$120.00 vs August" / "−$45.10 vs August" / "Same as August". */
export function changeText(change: { month: string; changeCents: number }): string {
  if (change.changeCents === 0) return `Same as ${monthOnly(change.month)}`;
  const sign = change.changeCents > 0 ? '+' : '−';
  return `${sign}${formatCents(Math.abs(change.changeCents))} vs ${monthOnly(change.month)}`;
}

/**
 * Bar heights for the net-by-month chart, as percentages of the tallest bar (screen geometry only). Months without
 * a figure, and negative months, get no bar.
 */
export function barHeights(values: (number | null)[]): (number | null)[] {
  const max = Math.max(0, ...values.map((v) => v ?? 0));
  return values.map((v) => (v === null || v <= 0 || max === 0 ? null : Math.max(4, (v / max) * 100)));
}

/** Share of a month's nights, as a width percentage for the "this month so far" bar (screen geometry only). */
export const widthOf = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);
