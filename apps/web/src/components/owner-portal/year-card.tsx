import type { ReactNode } from 'react';
import type { OwnerHome } from '@truhost/shared';
import { formatOccupancy } from '../../lib/format';
import { KpiMoney } from '../dashboard/kpi-card';

/**
 * The year so far, from the owner's released statements: what they were paid, nights booked, occupancy and average
 * nightly earnings, each on a soft tile under its own header, beneath a card header that says how much of the
 * year it covers.
 */
export function YearToDateCard({ ytd, month }: { ytd: OwnerHome['yearToDate']; month: string }) {
  const monthsSoFar = Number(month.slice(5, 7));
  return (
    <section aria-labelledby="ytd" className="rounded-card border border-line-soft bg-surface p-5 @2xl/content:p-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">Year to date</p>
          <h2 id="ytd" className="mt-1 text-xl font-bold tracking-tight text-ink">
            {ytd.year} so far
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            {ytd.months === 0
              ? 'These fill in as your monthly statements are released.'
              : `From your released statement${ytd.months === 1 ? '' : 's'}, so every figure is final.`}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-tint px-3 py-1 text-xs font-semibold text-sage-deep">
          <span aria-hidden className="size-1.5 rounded-full bg-sage-mid" />
          {ytd.months} of {monthsSoFar} month{monthsSoFar === 1 ? '' : 's'} released
        </span>
      </header>
      <dl className="grid grid-cols-2 gap-3 @3xl/content:grid-cols-4">
        <YearStat label="Net to you" value={<KpiMoney cents={ytd.netCents} />} support="Paid out this year" />
        <YearStat label="Nights booked" value={ytd.nightsBooked} support="By guests" />
        <YearStat label="Occupancy" value={formatOccupancy(ytd.occupancyBps)} support="Of the nights you didn’t use" />
        <YearStat
          label="Avg. nightly earnings"
          value={ytd.avgNightlyEarningsCents === null ? '—' : <KpiMoney cents={ytd.avgNightlyEarningsCents} />}
          support="After the cleaning fee"
        />
      </dl>
    </section>
  );
}

/** One figure: a small header ruled off from the figure below it, then a short note. */
function YearStat({ label, value, support }: { label: string; value: ReactNode; support: string }) {
  return (
    <div className="@container/stat flex min-w-0 flex-col rounded-inner bg-ground/70 px-4 pt-3.5 pb-4">
      {/* Room for two lines, label at the bottom: the rule and the figure line up across tiles even when a label
          (e.g. "Avg. nightly earnings") wraps. */}
      <dt className="flex min-h-[calc(2lh+0.5rem+1px)] items-end border-b border-line pb-2 text-xs font-semibold tracking-[0.08em] text-muted uppercase">
        {label}
      </dt>
      <dd className="figure mt-3 text-[1.625rem] leading-tight font-bold tracking-[-0.03em] whitespace-nowrap text-ink @[11rem]/stat:text-[1.875rem]">
        {value}
      </dd>
      <dd className="mt-1 text-xs text-muted">{support}</dd>
    </div>
  );
}
