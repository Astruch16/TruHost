import type { DashboardYear } from '../../lib/api-types';
import { formatBps, formatOccupancy } from '../../lib/format';
import { KpiCard, KpiMoney, KpiOf } from './kpi-card';
import { MonthBars } from './kpi-charts';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Year to date, as the month's four cards: gross, TruPlan fees, nights booked and avg. nightly earnings, each over
 * January through the chosen month, with a bar per month along the bottom. Every figure is the API's
 * (GET /v1/dashboard/year).
 */
export function YearKpis({ year, grid }: { year: DashboardYear; grid: string }) {
  const t = year.totals;
  const upcoming = year.months.map((m) => m.period === 'UPCOMING');
  const bars = (pick: (m: DashboardYear['months'][number]) => number | null, color: string) => (
    <MonthBars values={year.months.map(pick)} upcoming={upcoming} color={color} />
  );
  return (
    <div className={grid}>
      <KpiCard
        label="Gross revenue"
        value={<KpiMoney cents={t.grossCents} />}
        chart={bars((m) => m.grossCents, '#4F7A63')}
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
        chart={bars((m) => m.managementFeeCents, '#6A5FB8')}
        support={t.feeShareBps === null ? 'No gross yet' : `${formatBps(t.feeShareBps)} of gross`}
      />
      <KpiCard
        label="Nights booked"
        value={<KpiOf value={t.nightsBooked} of={t.availableNights} />}
        chart={bars((m) => m.occupancyBps, '#5F8FCB')}
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
        chart={bars((m) => m.avgNightlyEarningsCents, '#7C8381')}
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
