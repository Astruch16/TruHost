import { useState } from 'react';
import type { DashboardYear } from '../../lib/api-types';
import { cx } from '../../lib/cx';
import { monthLabel } from '../../lib/months';
import { monthShort, niceScale, TREND_METRICS, type TrendMetric } from '../../lib/trends';

const BAR = '#4F7A63';

/**
 * The year by month as a bar chart: pick a figure (gross, TruPlan fees, net to owners, nights, occupancy, avg. nightly)
 * and see each month from January through the chosen one. One series, so no legend: the picker names it. Hovering or
 * focusing a bar shows its value; months still to come are paler (booked so far). A table shows the same numbers.
 * Every value is the API's (GET /v1/dashboard/year); the scale is only for drawing.
 */
export function TrendsChart({ year }: { year: DashboardYear }) {
  const [metric, setMetric] = useState<TrendMetric>('gross');
  const [table, setTable] = useState(false);
  const m = TREND_METRICS.find((x) => x.key === metric)!;
  const rows = year.months.map((month) => ({ month, value: m.value(month) }));
  const scale = niceScale(rows.map((r) => r.value ?? 0));
  const range = scale.max - scale.min;
  const at = (v: number) => ((scale.max - v) / range) * 100; // % from the top
  const ticks = Array.from({ length: Math.round(range / scale.step) + 1 }, (_, i) => scale.max - i * scale.step);
  const note = (period: DashboardYear['months'][number]['period']) =>
    period === 'UPCOMING' ? 'booked so far' : period === 'MONTH_TO_DATE' ? 'so far' : null;
  const hasUpcoming = year.months.some((x) => x.period === 'UPCOMING');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Figure" className="flex flex-wrap gap-1.5">
          {TREND_METRICS.map((x) => (
            <button
              key={x.key}
              type="button"
              aria-pressed={metric === x.key}
              onClick={() => setMetric(x.key)}
              className={cx(
                'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                metric === x.key ? 'bg-primary text-white' : 'bg-ground text-muted hover:text-ink',
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setTable((v) => !v)}
          className="rounded-control-sm text-sm font-semibold text-primary hover:underline"
        >
          {table ? 'View as chart' : 'View as table'}
        </button>
      </div>

      {table ? (
        <table className="w-full text-sm">
          <caption className="sr-only">
            {m.label} by month, {year.year}
          </caption>
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="py-2 font-semibold">Month</th>
              <th className="py-2 text-right font-semibold">{m.label}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {rows.map(({ month, value }) => (
              <tr key={month.month}>
                <td className="py-2 text-ink">
                  {monthLabel(month.month)}
                  {note(month.period) && <span className="text-muted"> ({note(month.period)})</span>}
                </td>
                <td className="figure py-2 text-right font-semibold text-ink">
                  {value === null ? '—' : m.format(value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <figure className="flex flex-col gap-2">
          <figcaption className="text-sm text-muted">
            {m.label} by month, {monthShort(year.months[0]!.month)} – {monthShort(year.through)} {year.year}
            {hasUpcoming && '. Paler months are booked so far.'}
          </figcaption>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3">
            {/* Axis labels, then the plot with its gridlines */}
            <div className="relative h-56 w-12" aria-hidden>
              {ticks.map((v) => (
                <span
                  key={v}
                  className="figure absolute right-0 -translate-y-1/2 text-[11px] text-muted"
                  style={{ top: `${at(v)}%` }}
                >
                  {m.tick(v)}
                </span>
              ))}
            </div>
            <div className="relative h-56">
              {ticks.map((v) => (
                <span
                  key={v}
                  aria-hidden
                  className={cx('absolute inset-x-0 h-px', v === 0 ? 'bg-ink/25' : 'bg-line-soft')}
                  style={{ top: `${at(v)}%` }}
                />
              ))}
              <ul aria-label={`${m.label} by month`} className="absolute inset-0 flex">
                {rows.map(({ month, value }) => {
                  const v = value ?? 0;
                  const top = at(Math.max(v, 0));
                  const height = (Math.abs(v) / range) * 100;
                  const label = `${monthLabel(month.month)}: ${value === null ? 'no figure' : m.format(value)}${
                    note(month.period) ? ` (${note(month.period)})` : ''
                  }`;
                  return (
                    <li
                      key={month.month}
                      tabIndex={0}
                      aria-label={label}
                      className="group relative flex-1 focus-visible:outline-none"
                    >
                      {/* The bar, with a 2px gap either side; rounded at its data end. */}
                      {value !== null && v !== 0 && (
                        <span
                          aria-hidden
                          className={cx(
                            'absolute left-1/2 w-[min(70%,2.75rem)] -translate-x-1/2 transition-opacity group-hover:brightness-110',
                            v > 0 ? 'rounded-t-[4px]' : 'rounded-b-[4px]',
                          )}
                          style={{
                            top: `${top}%`,
                            height: `${height}%`,
                            background: BAR,
                            opacity: month.period === 'UPCOMING' ? 0.45 : 1,
                          }}
                        />
                      )}
                      {/* Tooltip: on hover or focus, above the bar */}
                      <span
                        aria-hidden
                        className="pointer-events-none absolute left-1/2 z-10 hidden -translate-x-1/2 -translate-y-full rounded-control bg-ink px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg group-hover:block group-focus-visible:block"
                        style={{ top: `calc(${top}% - 6px)` }}
                      >
                        <span className="font-semibold">{monthLabel(month.month)}</span>
                        <span className="figure block">
                          {value === null ? '—' : m.format(value)}
                          {note(month.period) && <span className="text-white/70"> {note(month.period)}</span>}
                        </span>
                      </span>
                      <span
                        aria-hidden
                        className="absolute inset-0 rounded-sm group-focus-visible:ring-2 group-focus-visible:ring-blue-deep"
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
            <span />
            <div aria-hidden className="mt-1.5 flex">
              {rows.map(({ month }) => (
                <span key={month.month} className="flex-1 text-center text-[11px] font-medium text-muted">
                  {monthShort(month.month)}
                </span>
              ))}
            </div>
          </div>
        </figure>
      )}
    </div>
  );
}
