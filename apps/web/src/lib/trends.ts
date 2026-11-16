import type { DashboardYear } from './api-types';
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
}[] = [
  { key: 'gross', label: 'Gross revenue', value: (m) => m.grossCents, format: formatCents, tick: formatCentsShort },
  {
    key: 'fees',
    label: 'TruPlan fees',
    value: (m) => m.managementFeeCents,
    format: formatCents,
    tick: formatCentsShort,
  },
  { key: 'net', label: 'Net to owners', value: (m) => m.netToOwnersCents, format: formatCents, tick: formatCentsShort },
  { key: 'nights', label: 'Nights booked', value: (m) => m.nightsBooked, format: String, tick: String },
  {
    key: 'occupancy',
    label: 'Occupancy',
    value: (m) => m.occupancyBps,
    format: formatOccupancy,
    tick: formatOccupancy,
  },
  {
    key: 'nightly',
    label: 'Avg. nightly',
    value: (m) => m.avgNightlyEarningsCents,
    format: formatCents,
    tick: formatCentsShort,
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
