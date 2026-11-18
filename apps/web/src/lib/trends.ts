import type { DashboardYear } from './api-types';
import type { queries } from './queries';
import { formatOccupancy } from './format';
import { formatCents, formatCentsShort } from './money';

/**
 * The year's trends, for display only: which figure to chart, how to word it, and a tidy scale for the axis. Every
 * value is one the API computed (GET /v1/dashboard/year); nothing here calculates money.
 */
export type TrendMonth = DashboardYear['months'][number];

export type TrendMetric = 'gross' | 'fees' | 'net' | 'nights' | 'occupancy' | 'nightly';

export const TREND_METRICS: readonly {
  key: TrendMetric;
  label: string;
  value: (m: TrendMonth) => number | null;
  /** The value in full, for tooltips and the table. */
  format: (v: number) => string;
  /** The value as an axis label: short. */
  tick: (v: number) => string;
  /** The line's colour: one series per chart, so no legend; the figure's name says what it is. */
  color: string;
}[] = [
  {
    key: 'gross',
    label: 'Gross revenue',
    value: (m) => m.grossCents,
    format: formatCents,
    tick: formatCentsShort,
    color: '#4F7A63',
  },
  {
    key: 'fees',
    label: 'TruPlan fees',
    value: (m) => m.managementFeeCents,
    format: formatCents,
    tick: formatCentsShort,
    color: '#6A5FB8',
  },
  {
    key: 'net',
    label: 'Net to owners',
    value: (m) => m.netToOwnersCents,
    format: formatCents,
    tick: formatCentsShort,
    color: '#3F7A8C',
  },
  {
    key: 'nights',
    label: 'Nights booked',
    value: (m) => m.nightsBooked,
    format: (v) => `${v} night${v === 1 ? '' : 's'}`,
    tick: String,
    color: '#5F8FCB',
  },
  {
    key: 'occupancy',
    label: 'Occupancy',
    value: (m) => m.occupancyBps,
    format: formatOccupancy,
    tick: formatOccupancy,
    color: '#4E78B0',
  },
  {
    key: 'nightly',
    label: 'Avg. nightly',
    value: (m) => m.avgNightlyEarningsCents,
    format: formatCents,
    tick: formatCentsShort,
    color: '#6E7674',
  },
];

/** "Jan", "Feb"… from "2026-01". */
export const monthShort = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-CA', { month: 'short', timeZone: 'UTC' });

/**
 * An axis for `values` that always includes zero, in about `ticks` evenly spaced round steps (1, 2 or 5 × a power of
 * ten). Negative values (a month where owners would owe) get room below zero.
 */
export function niceScale(values: readonly number[], ticks = 4): { min: number; max: number; step: number } {
  const hi = Math.max(0, ...values);
  const lo = Math.min(0, ...values);
  const span = hi - lo;
  if (span === 0) return { min: 0, max: 1, step: 1 };
  const raw = span / ticks;
  const power = 10 ** Math.floor(Math.log10(raw));
  // The round step nearest the ideal one (by ratio), so the axis is neither crowded nor mostly empty.
  const step = [1, 2, 5, 10]
    .map((m) => m * power)
    .reduce((best, s) => (Math.abs(Math.log(s / raw)) < Math.abs(Math.log(best / raw)) ? s : best));
  return { min: Math.floor(lo / step) * step, max: Math.ceil(hi / step) * step, step };
}

export const trendMetric = (key: TrendMetric) => TREND_METRICS.find((x) => x.key === key)!;

/** "J", "F"… from "2026-01": the month's initial, for a small chart's axis. */
export const monthInitial = (month: string) => monthShort(month).charAt(0);

/** The twelve months of `year`, "2026-01" through "2026-12". */
export const yearMonths = (year: number): string[] =>
  Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);

/**
 * The month with the highest value among those already under way or ended (months to come are only what's booked
 * so far, so they don't count). Null when no such month has a figure above zero. A comparison of the API's values,
 * not a calculation.
 */
export function bestMonth(months: readonly TrendMonth[], value: (m: TrendMonth) => number | null): TrendMonth | null {
  let best: TrendMonth | null = null;
  for (const m of months) {
    const v = value(m);
    if (m.period === 'UPCOMING' || v === null || v <= 0) continue;
    if (!best || v > (value(best) ?? 0)) best = m;
  }
  return best;
}

/** Whether a year has anything in it: a stay or a booked night in any month. */
export const hasFigures = (months: readonly TrendMonth[]) => months.some((m) => m.stays > 0 || m.nightsBooked > 0);

/** What a month's figure covers when it isn't a finished month: "so far" or "booked so far". */
export const periodNote = (period: TrendMonth['period']) =>
  period === 'UPCOMING' ? 'booked so far' : period === 'MONTH_TO_DATE' ? 'so far' : null;

/** How the trend chart loads a year other than the dashboard's: the year's query, January through `through`. */
export type YearQuery = (through: string) => ReturnType<typeof queries.dashboardYear>;
