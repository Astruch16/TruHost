import type { ReactNode } from 'react';
import type { OwnerHome } from '@truhost/shared';
import { BedDouble, ChartPie, Coins, Wallet, type LucideIcon } from 'lucide-react';
import { cx } from '../../lib/cx';
import { formatOccupancy } from '../../lib/format';
import { KpiMoney } from '../dashboard/kpi-card';

/**
 * The year so far, from the owner's released statements: what they were paid, nights booked, occupancy and average
 * nightly earnings, each on a soft tile with its icon, under a header that says how much of the year it covers.
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
        <YearStat
          icon={Wallet}
          tone="sage"
          label="Net to you"
          value={<KpiMoney cents={ytd.netCents} />}
          support="Paid out this year"
        />
        <YearStat icon={BedDouble} tone="blue" label="Nights booked" value={ytd.nightsBooked} support="By guests" />
        <YearStat
          icon={ChartPie}
          tone="lavender"
          label="Occupancy"
          value={formatOccupancy(ytd.occupancyBps)}
          support="Of the nights you didn’t use"
        />
        <YearStat
          icon={Coins}
          tone="amber"
          label="Avg. nightly earnings"
          value={ytd.avgNightlyEarningsCents === null ? '—' : <KpiMoney cents={ytd.avgNightlyEarningsCents} />}
          support="After the cleaning fee"
        />
      </dl>
    </section>
  );
}

const TONE = {
  sage: 'bg-sage-tint text-sage-deep',
  blue: 'bg-blue-tint text-blue-deep',
  lavender: 'bg-lavender-tint text-lavender-deep',
  amber: 'bg-amber-tint text-amber-deep',
} as const;

function YearStat({
  icon: Icon,
  tone,
  label,
  value,
  support,
}: {
  icon: LucideIcon;
  tone: keyof typeof TONE;
  label: string;
  value: ReactNode;
  support: string;
}) {
  return (
    <div className="@container/stat flex min-w-0 flex-col rounded-inner bg-ground/70 p-4">
      <span aria-hidden className={cx('mb-3 grid size-9 place-items-center rounded-xl', TONE[tone])}>
        <Icon className="size-[18px]" />
      </span>
      <dt className="text-[13px] font-semibold text-muted">{label}</dt>
      <dd className="figure mt-0.5 text-[1.625rem] leading-tight font-bold tracking-[-0.03em] whitespace-nowrap text-ink @[11rem]/stat:text-[1.875rem]">
        {value}
      </dd>
      <dd className="mt-1 text-xs text-muted">{support}</dd>
    </div>
  );
}
