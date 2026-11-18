import { LineChart } from 'lucide-react';
import type { DashboardYear } from '../../lib/api-types';
import { formatBps, formatOccupancy } from '../../lib/format';
import { bestMonth, monthShort, periodNote, trendMetric, type TrendMetric, type TrendMonth } from '../../lib/trends';
import { KpiCard, KpiMoney, KpiOf } from './kpi-card';
import { MonthBars } from './kpi-charts';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Year to date, as the month's four cards: gross, TruPlan fees, nights booked and avg. nightly earnings, each over
 * January through the chosen month. Along the bottom, a bar per month (lettered, with its value on hover) and the
 * year's best month; clicking there opens that figure's trend. Every figure is the API's (GET /v1/dashboard/year).
 */
export function YearKpis({
  year,
  grid,
  onOpenTrend,
}: {
  year: DashboardYear;
  grid: string;
  onOpenTrend: (metric: TrendMetric) => void;
}) {
  const t = year.totals;
  const chart = (key: TrendMetric) => <MonthChart year={year} metric={key} onOpen={() => onOpenTrend(key)} />;
  return (
    <div className={grid}>
      <KpiCard
        label="Gross revenue"
        value={<KpiMoney cents={t.grossCents} />}
        chart={chart('gross')}
        support={
          <>
            From <strong className="text-ink">{plural(t.stays, 'stay', 'stays')}</strong>
            {t.incompleteBookings > 0 && <> · {t.incompleteBookings} waiting on payout</>}
          </>
        }
      />
      <KpiCard
        label="TruPlan fees earned"
        value={<KpiMoney cents={t.managementFeeCents} />}
        chart={chart('fees')}
        support={t.feeShareBps === null ? 'No gross yet' : `${formatBps(t.feeShareBps)} of gross`}
      />
      <KpiCard
        label="Nights booked"
        value={<KpiOf value={t.nightsBooked} of={t.availableNights} />}
        chart={chart('nights')}
        support={
          t.occupancyBps === null ? (
            'No nights available'
          ) : (
            <>
              <strong className="text-ink">{formatOccupancy(t.occupancyBps)}</strong> occupancy
            </>
          )
        }
      />
      <KpiCard
        label="Avg. nightly earnings"
        value={t.avgNightlyEarningsCents === null ? '—' : <KpiMoney cents={t.avgNightlyEarningsCents} />}
        chart={chart('nightly')}
        support={
          t.completeNights > 0 ? (
            <>
              Across <strong className="text-ink">{plural(t.completeNights, 'night', 'nights')}</strong>
            </>
          ) : (
            'No completed stays yet'
          )
        }
      />
    </div>
  );
}

/** A card's month bars with the year's best month under them; the whole area opens the figure's trend. */
function MonthChart({ year, metric, onOpen }: { year: DashboardYear; metric: TrendMetric; onOpen: () => void }) {
  const m = trendMetric(metric);
  const best = bestMonth(year.months, m.value);
  const describe = (row: TrendMonth) => {
    const v = m.value(row);
    const note = periodNote(row.period);
    return `${monthShort(row.month)} ${row.month.slice(0, 4)} · ${v === null ? '—' : m.format(v)}${note ? ` (${note})` : ''}`;
  };
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${m.label} by month: view the trend`}
      className="group -m-1.5 flex w-[calc(100%+0.75rem)] flex-col gap-2 rounded-inner p-1.5 text-left transition-colors hover:bg-ground focus-visible:outline-2 focus-visible:outline-blue-deep"
    >
      <MonthBars
        months={year.months.map((x) => x.month)}
        values={year.months.map(m.value)}
        upcoming={year.months.map((x) => x.period === 'UPCOMING')}
        color={m.color}
        describe={(i) => describe(year.months[i]!)}
      />
      <span aria-hidden className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-muted">
        <span className="whitespace-nowrap">
          {best ? (
            <>
              Best <strong className="font-semibold text-ink">{monthShort(best.month)}</strong>{' '}
              <span className="figure">{m.format(m.value(best)!)}</span>
            </>
          ) : (
            'No figures yet'
          )}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary group-hover:underline">
          <LineChart className="size-3.5" /> View trend
        </span>
      </span>
    </button>
  );
}
