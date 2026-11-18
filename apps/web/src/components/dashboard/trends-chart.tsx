import { useRef, useState, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cx } from '../../lib/cx';
import { addMonths, monthLabel } from '../../lib/months';
import {
  bestMonth,
  hasFigures,
  monthInitial,
  monthShort,
  niceScale,
  periodNote,
  TREND_METRICS,
  trendMetric,
  yearMonths,
  type TrendMetric,
  type TrendMonth,
  type YearQuery,
} from '../../lib/trends';
import type { DashboardYear } from '../../lib/api-types';
import { Skeleton } from '../ui/skeleton';

/**
 * The year by month as a line chart: pick a figure (gross, TruPlan fees, net to owners, nights, occupancy, avg.
 * nightly), step through the months (‹ ›, the arrow keys, or a click on the chart) and through the years. The chosen
 * month's figure leads, with the month before it and the year's best month beside it. Hovering shows any month's
 * value; months still to come are paler (booked so far). A table shows the same numbers.
 *
 * `year` is the dashboard's own year (January through its month); other years load through `yearQuery`. Every value
 * is the API's (GET /v1/dashboard/year); the scale is only for drawing, and nothing here calculates money.
 */
export function TrendsChart({
  year: current,
  yearQuery,
  initialMetric = 'gross',
}: {
  year: DashboardYear;
  yearQuery: YearQuery;
  initialMetric?: TrendMetric;
}) {
  const [metric, setMetric] = useState<TrendMetric>(initialMetric);
  const [table, setTable] = useState(false);
  const [picked, setPicked] = useState(current.through);
  const shownYear = Number(picked.slice(0, 4));
  const isCurrent = shownYear === current.year;
  const other = useQuery({ ...yearQuery(`${shownYear}-12`), enabled: !isCurrent });
  const data = isCurrent ? current : other.data?.year === shownYear ? other.data : undefined;
  const m = trendMetric(metric);

  // The chosen month, kept within the months the year has (a year switch keeps the month where it can).
  const months = data?.months ?? [];
  const selected = months.find((x) => x.month === picked) ?? months.at(-1);
  const lastYear = Math.max(current.year, Number(current.today.slice(0, 4)));
  const canPrevYear = data !== undefined && hasFigures(data.months);
  const canNextYear = shownYear < lastYear;
  const pick = (month: string) => setPicked(month);
  const stepYear = (by: number) => setPicked(`${shownYear + by}${picked.slice(4)}`);
  const stepMonth = (by: number) => {
    const from = selected?.month ?? picked;
    const to = addMonths(from, by);
    if (Number(to.slice(0, 4)) !== shownYear) {
      if (by < 0 ? !canPrevYear : !canNextYear) return;
      setPicked(to);
    } else if (months.some((x) => x.month === to)) setPicked(to);
  };
  const atStart = selected?.month.endsWith('-01') ? !canPrevYear : !selected;
  const atEnd =
    !selected || (selected.month === months.at(-1)?.month && (!selected.month.endsWith('-12') || !canNextYear));

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

      <div className="flex flex-wrap items-end justify-between gap-3">
        <Readout data={data} selected={selected} metric={metric} />
        <div className="flex items-center gap-2">
          <Stepper
            label={selected ? monthLabel(selected.month) : monthLabel(picked)}
            what="month"
            onPrev={() => stepMonth(-1)}
            onNext={() => stepMonth(1)}
            prevDisabled={atStart}
            nextDisabled={atEnd}
            wide
          />
          <Stepper
            label={String(shownYear)}
            what="year"
            onPrev={() => stepYear(-1)}
            onNext={() => stepYear(1)}
            prevDisabled={!canPrevYear}
            nextDisabled={!canNextYear}
          />
        </div>
      </div>

      {!data ? (
        other.isError ? (
          <p className="grid h-60 place-items-center rounded-inner bg-ground text-sm text-muted">
            <span>
              Couldn’t load {shownYear}.{' '}
              <button
                type="button"
                className="font-semibold text-primary hover:underline"
                onClick={() => void other.refetch()}
              >
                Try again
              </button>
            </span>
          </p>
        ) : (
          <Skeleton className="h-60 rounded-inner" />
        )
      ) : table ? (
        <table className="w-full text-sm">
          <caption className="sr-only">
            {m.label} by month, {data.year}
          </caption>
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="py-2 font-semibold">Month</th>
              <th className="py-2 text-right font-semibold">{m.label}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {data.months.map((month) => {
              const value = m.value(month);
              return (
                <tr key={month.month} className={cx(month.month === selected?.month && 'bg-ground')}>
                  <td className="py-2 text-ink">
                    {monthLabel(month.month)}
                    {periodNote(month.period) && <span className="text-muted"> ({periodNote(month.period)})</span>}
                  </td>
                  <td className="figure py-2 text-right font-semibold text-ink">
                    {value === null ? '—' : m.format(value)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <LineChart year={data} metric={metric} selected={selected?.month ?? null} onPick={pick} />
      )}
    </div>
  );
}

/** The chosen month's figure, large, with the month before it and the year's best month. */
function Readout({
  data,
  selected,
  metric,
}: {
  data: DashboardYear | undefined;
  selected: TrendMonth | undefined;
  metric: TrendMetric;
}) {
  const m = trendMetric(metric);
  if (!data || !selected) return <Skeleton className="h-16 w-56 rounded-inner" />;
  const value = m.value(selected);
  const before = data.months.find((x) => x.month === addMonths(selected.month, -1));
  const beforeValue = before ? m.value(before) : null;
  const best = bestMonth(data.months, m.value);
  const note = periodNote(selected.period);
  return (
    <div aria-live="polite" className="min-w-0">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">
        {m.label} · {monthLabel(selected.month)}
        {note && <span className="tracking-normal normal-case"> ({note})</span>}
      </p>
      <p className="figure text-[1.75rem] leading-tight font-bold tracking-[-0.02em] text-ink">
        {value === null ? '—' : m.format(value)}
      </p>
      <p className="mt-0.5 flex flex-wrap gap-x-3 text-[13px] text-muted">
        {before && (
          <span>
            {monthShort(before.month)}:{' '}
            <strong className="figure font-semibold text-ink">
              {beforeValue === null ? '—' : m.format(beforeValue)}
            </strong>
          </span>
        )}
        {best && (
          <span>
            Best ({monthShort(best.month)}):{' '}
            <strong className="figure font-semibold text-ink">{m.format(m.value(best)!)}</strong>
          </span>
        )}
      </p>
    </div>
  );
}

function Stepper({
  label,
  what,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
  wide,
}: {
  label: string;
  what: string;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled: boolean;
  nextDisabled: boolean;
  wide?: boolean;
}) {
  const button =
    'grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-blue-deep disabled:pointer-events-none disabled:opacity-35';
  return (
    <div className="inline-flex items-center rounded-full bg-surface p-0.5 ring-1 ring-line">
      <button type="button" aria-label={`Previous ${what}`} className={button} onClick={onPrev} disabled={prevDisabled}>
        <ChevronLeft aria-hidden className="size-4" />
      </button>
      <span className={cx('figure text-center text-sm font-semibold text-ink', wide ? 'min-w-28' : 'min-w-11')}>
        {label}
      </span>
      <button type="button" aria-label={`Next ${what}`} className={button} onClick={onNext} disabled={nextDisabled}>
        <ChevronRight aria-hidden className="size-4" />
      </button>
    </div>
  );
}

/**
 * The line itself: twelve month columns, January to December. A 2px line through dot markers with a pale wash under
 * it; months to come are paler. The chosen month carries a hairline and a larger dot; hovering any month shows a
 * hairline and its value. Each month with a figure is a button (arrow keys move between them).
 */
function LineChart({
  year,
  metric,
  selected,
  onPick,
}: {
  year: DashboardYear;
  metric: TrendMetric;
  selected: string | null;
  onPick: (month: string) => void;
}) {
  const m = trendMetric(metric);
  const [hover, setHover] = useState<string | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const slots = yearMonths(year.year).map((month) => {
    const row = year.months.find((x) => x.month === month);
    return { month, row, value: row ? m.value(row) : null };
  });
  const scale = niceScale(slots.map((s) => s.value ?? 0));
  const range = scale.max - scale.min;
  const y = (v: number) => ((scale.max - v) / range) * 100; // % from the top
  const x = (i: number) => ((i + 0.5) / 12) * 100; // % from the left, the column's middle
  const ticks = Array.from({ length: Math.round(range / scale.step) + 1 }, (_, i) => scale.max - i * scale.step);
  const zero = y(0);

  // Line segments between neighbouring months that both have a figure; the wash under each finished stretch.
  const segments = slots.slice(1).flatMap((s, j) => {
    const a = slots[j]!;
    if (a.value === null || s.value === null) return [];
    return [
      { key: s.month, d: `M${x(j)} ${y(a.value)} L${x(j + 1)} ${y(s.value)}`, faint: s.row?.period === 'UPCOMING' },
    ];
  });
  const runs: { i: number; v: number }[][] = [];
  slots.forEach((s, i) => {
    if (s.value === null || s.row?.period === 'UPCOMING') return runs.push([]);
    if (runs.length === 0) runs.push([]);
    runs.at(-1)!.push({ i, v: s.value });
  });
  const washes = runs
    .filter((r) => r.length > 1)
    .map(
      (r) => `M${x(r[0]!.i)} ${zero} ${r.map((p) => `L${x(p.i)} ${y(p.v)}`).join(' ')} L${x(r.at(-1)!.i)} ${zero} Z`,
    );

  const withFigures = slots.filter((s) => s.row);
  const onKey = (e: KeyboardEvent, month: string) => {
    const at = withFigures.findIndex((s) => s.month === month);
    const to =
      e.key === 'ArrowLeft' || e.key === 'ArrowDown'
        ? withFigures[at - 1]
        : e.key === 'ArrowRight' || e.key === 'ArrowUp'
          ? withFigures[at + 1]
          : e.key === 'Home'
            ? withFigures[0]
            : e.key === 'End'
              ? withFigures.at(-1)
              : undefined;
    if (!to) return;
    e.preventDefault();
    onPick(to.month);
    buttons.current.get(to.month)?.focus();
  };
  const focusable = selected ?? withFigures.at(-1)?.month;
  const hovered = slots.find((s) => s.month === hover);
  const hasUpcoming = year.months.some((x) => x.period === 'UPCOMING');

  return (
    <figure className="@container/chart flex flex-col gap-2">
      <figcaption className="sr-only">
        {m.label} by month, {year.year}
        {hasUpcoming && '. Paler months are booked so far.'}
      </figcaption>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3">
        <div className="relative h-60 w-12" aria-hidden>
          {ticks.map((v) => (
            <span
              key={v}
              className="figure absolute right-0 -translate-y-1/2 text-[11px] text-muted"
              style={{ top: `${y(v)}%` }}
            >
              {m.tick(v)}
            </span>
          ))}
        </div>
        <div className="relative h-60" onMouseLeave={() => setHover(null)}>
          {ticks.map((v) => (
            <span
              key={v}
              aria-hidden
              className={cx('absolute inset-x-0 h-px', v === 0 ? 'bg-ink/25' : 'bg-line-soft')}
              style={{ top: `${y(v)}%` }}
            />
          ))}
          {/* Hairlines: the chosen month's, and the hovered one's */}
          {selected && (
            <span
              aria-hidden
              className="absolute inset-y-0 w-px -translate-x-1/2 bg-ink/30"
              style={{ left: `${x(slots.findIndex((s) => s.month === selected))}%` }}
            />
          )}
          {hovered && hovered.month !== selected && (
            <span
              aria-hidden
              className="absolute inset-y-0 w-px -translate-x-1/2 bg-ink/15"
              style={{ left: `${x(slots.indexOf(hovered))}%` }}
            />
          )}
          <svg
            aria-hidden
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 size-full overflow-visible"
          >
            {washes.map((d) => (
              <path key={d} d={d} fill={m.color} opacity={0.1} />
            ))}
            {segments.map((s) => (
              <path
                key={s.key}
                d={s.d}
                fill="none"
                stroke={m.color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                opacity={s.faint ? 0.45 : 1}
              />
            ))}
          </svg>
          {/* Dots, ringed in the surface colour so they read where they sit on the line */}
          {slots.map((s, i) =>
            s.value === null ? null : (
              <span
                key={s.month}
                aria-hidden
                className={cx(
                  'absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface transition-[width,height]',
                  s.month === selected ? 'size-3.5' : s.month === hover ? 'size-3' : 'size-2',
                )}
                style={{
                  left: `${x(i)}%`,
                  top: `${y(s.value)}%`,
                  background: m.color,
                  opacity: s.row?.period === 'UPCOMING' ? 0.5 : 1,
                }}
              />
            ),
          )}
          {/* Hover tooltip, above the hovered month's dot */}
          {hovered && hovered.row && (
            <span
              aria-hidden
              className={cx(
                'pointer-events-none absolute z-10 -translate-y-full rounded-control bg-ink px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg',
                slots.indexOf(hovered) > 8 ? '-translate-x-full' : slots.indexOf(hovered) < 3 ? '' : '-translate-x-1/2',
              )}
              style={{ left: `${x(slots.indexOf(hovered))}%`, top: `calc(${y(hovered.value ?? 0)}% - 10px)` }}
            >
              <span className="font-semibold">{monthLabel(hovered.month)}</span>
              <span className="figure block">
                {hovered.value === null ? '—' : m.format(hovered.value)}
                {periodNote(hovered.row.period) && (
                  <span className="text-white/70"> {periodNote(hovered.row.period)}</span>
                )}
              </span>
            </span>
          )}
          {!hasFigures(year.months) && (
            <p className="absolute inset-x-0 top-1/3 text-center text-sm font-semibold text-muted">
              No stays in {year.year}
            </p>
          )}
          {/* One column per month: the hit target, much bigger than the dot */}
          <div role="group" aria-label={`${m.label} by month`} className="absolute inset-0 flex">
            {slots.map((s) =>
              s.row ? (
                <button
                  key={s.month}
                  ref={(el) => {
                    if (el) buttons.current.set(s.month, el);
                    else buttons.current.delete(s.month);
                  }}
                  type="button"
                  tabIndex={s.month === focusable ? 0 : -1}
                  aria-pressed={s.month === selected}
                  aria-label={`${monthLabel(s.month)}: ${s.value === null ? 'no figure' : m.format(s.value)}${
                    periodNote(s.row.period) ? ` (${periodNote(s.row.period)})` : ''
                  }`}
                  onMouseEnter={() => setHover(s.month)}
                  onFocus={() => setHover(s.month)}
                  onBlur={() => setHover(null)}
                  onClick={() => onPick(s.month)}
                  onKeyDown={(e) => onKey(e, s.month)}
                  className="flex-1 cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-deep"
                />
              ) : (
                <span key={s.month} aria-hidden className="flex-1" />
              ),
            )}
          </div>
        </div>
        <span />
        <div aria-hidden className="mt-1.5 flex">
          {slots.map((s) => (
            <span
              key={s.month}
              className={cx(
                'flex-1 text-center text-[11px]',
                s.month === selected ? 'font-bold text-ink' : s.row ? 'font-medium text-muted' : 'text-muted/50',
              )}
            >
              <span className="hidden @[30rem]/chart:inline">{monthShort(s.month)}</span>
              <span className="@[30rem]/chart:hidden">{monthInitial(s.month)}</span>
            </span>
          ))}
        </div>
      </div>
      {hasUpcoming && <p className="text-xs text-muted">Paler months are booked so far.</p>}
    </figure>
  );
}
