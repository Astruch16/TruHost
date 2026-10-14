import type { Dashboard } from '../../lib/api-types';
import { KpiCard, KpiMoney, KpiOf } from '../dashboard/kpi-card';
import { NightlyRange, StaysBar } from '../dashboard/kpi-charts';

/**
 * The month's money at a glance, above the bookings list: owner gross, how many payouts are in, cleaning fees and
 * average nightly earnings. Every figure comes from the API's reporting (the dashboard read); none is worked out here.
 */
export function BookingsSummary({ data }: { data: Dashboard }) {
  const k = data.kpis;
  const entered = k.stays - k.incompleteBookings;
  return (
    <div className="grid grid-cols-2 gap-3 @2xl/content:grid-cols-4 @2xl/content:gap-4">
      <KpiCard
        label="Owner gross"
        value={<KpiMoney cents={k.grossCents} />}
        support={
          <>
            From <strong className="text-ink">{k.stays}</strong> stay{k.stays === 1 ? '' : 's'}
          </>
        }
        chart={<StaysBar grossByStayCents={k.grossByStayCents} />}
      />
      <KpiCard
        label="Payouts entered"
        value={<KpiOf value={entered} of={k.stays} />}
        support={
          k.incompleteBookings > 0 ? (
            <>
              <strong className="text-ink">{k.incompleteBookings}</strong> waiting on payout
            </>
          ) : k.stays > 0 ? (
            'All in'
          ) : (
            'No stays yet'
          )
        }
        chart={<Progress done={entered} of={k.stays} />}
      />
      <KpiCard
        label="Cleaning fees"
        value={<KpiMoney cents={data.breakdown.cleaningFeesCents} />}
        support="Kept by TruHost, not owner gross"
      />
      <KpiCard
        label="Avg. nightly earnings"
        value={k.avgNightlyEarningsCents === null ? '—' : <KpiMoney cents={k.avgNightlyEarningsCents} />}
        support={
          <>
            Across <strong className="text-ink">{k.completeNights}</strong> night{k.completeNights === 1 ? '' : 's'}
          </>
        }
        chart={<NightlyRange lowCents={k.nightlyLowCents} highCents={k.nightlyHighCents} />}
      />
    </div>
  );
}

/** How many of the month's payouts are in, as a bar. */
function Progress({ done, of }: { done: number; of: number }) {
  return (
    <span aria-hidden className="block h-1.5 overflow-hidden rounded-full bg-line-soft">
      <span
        className="block h-full rounded-full bg-sage-mid transition-[width] duration-500"
        style={{ width: of > 0 ? `${(done / of) * 100}%` : '0%' }}
      />
    </span>
  );
}
