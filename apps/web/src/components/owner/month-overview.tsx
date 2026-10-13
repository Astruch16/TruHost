import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MonthFigures } from '@truhost/shared';
import { OWN_PROPERTY_PLAN_ID } from '@truhost/shared';
import { useApi } from '../../lib/api-context';
import { cx } from '../../lib/cx';
import { formatBps, formatOccupancy } from '../../lib/format';
import { formatCents } from '../../lib/money';
import { monthLabel } from '../../lib/months';
import { usePrefetchAdjacentMonths } from '../../lib/month-prefetch';
import { queries } from '../../lib/queries';
import { updatingStyles } from '../../lib/styles';
import { LoadError } from '../ui/alert';
import { Card } from '../ui/card';
import { MonthStepper } from '../ui/month-stepper';
import { Skeleton } from '../ui/skeleton';

/**
 * The owner's month: what they earned (net) up front, then gross, nights and occupancy, and average nightly earnings,
 * and where the gross went (fee, expenses, net) as a bar. All figures come from the API's reporting module. The
 * month stepper here drives the whole page.
 */
export function MonthOverview({
  propertyId,
  month,
  onMonthChange,
}: {
  propertyId: string;
  month: string;
  onMonthChange: (month: string) => void;
}) {
  const api = useApi();
  const summary = useQuery(queries.propertySummary(api, propertyId, month));
  usePrefetchAdjacentMonths(month, (m) => queries.propertySummary(api, propertyId, m), summary.isSuccess);
  const f = summary.data;

  return (
    <Card
      title="Your month"
      description={monthLabel(month)}
      actions={<MonthStepper month={month} onChange={onMonthChange} />}
    >
      {summary.error ? (
        <LoadError what="this month’s figures" onRetry={() => void summary.refetch()} retrying={summary.isFetching} />
      ) : !f ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 rounded-inner" />
          <Skeleton className="h-24 rounded-inner" />
        </div>
      ) : (
        <div
          aria-busy={summary.isPlaceholderData || undefined}
          className={cx('flex flex-col gap-6', updatingStyles(summary.isPlaceholderData))}
        >
          <Figures f={f} />
          {f.grossCents > 0 || f.ownerExpensesCents > 0 ? (
            <Breakdown f={f} />
          ) : (
            <p className="rounded-inner bg-ground px-4 py-5 text-center text-sm text-muted">
              No earnings or expenses in {monthLabel(month)} yet.
            </p>
          )}
          {f.incompleteBookings > 0 && (
            <p className="text-sm text-muted">
              {f.incompleteBookings} stay{f.incompleteBookings === 1 ? ' is' : 's are'} waiting on a payout and not
              counted yet.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

function Figures({ f }: { f: MonthFigures }) {
  return (
    <div className="grid gap-3 @xl/content:grid-cols-[1.3fr_1fr_1fr]">
      <div className="flex flex-col justify-between gap-3 rounded-inner bg-primary p-5 text-white @xl/content:row-span-2">
        <p className="text-sm font-medium text-primary-ink-muted">Net to you</p>
        <p className="figure text-4xl font-bold tracking-tight">{formatCents(f.netCents)}</p>
        <p className="text-xs text-primary-ink-muted">
          {f.managementFeeCents > 0 ? 'After the management fee and expenses.' : 'After expenses.'}
        </p>
      </div>
      <Tile
        label="Gross revenue"
        value={formatCents(f.grossCents)}
        note={`${f.stays} stay${f.stays === 1 ? '' : 's'}`}
      />
      <Tile
        label="Nights booked"
        value={`${f.nightsBooked} of ${f.availableNights}`}
        note={
          <span className="flex items-center gap-2">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line-soft">
              <span
                className="block h-full rounded-full bg-sage-mid"
                style={{ width: `${Math.min(100, (f.occupancyBps ?? 0) / 100)}%` }}
              />
            </span>
            {formatOccupancy(f.occupancyBps)}
          </span>
        }
      />
      <Tile
        className="@xl/content:col-start-2 @xl/content:col-end-4"
        label="Avg. nightly earnings"
        value={f.avgNightlyEarningsCents === null ? '—' : formatCents(f.avgNightlyEarningsCents)}
        note="Your gross per booked night"
      />
    </div>
  );
}

function Tile({
  label,
  value,
  note,
  className,
}: {
  label: string;
  value: string;
  note: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-col gap-1 rounded-inner border border-line-soft p-4', className)}>
      <p className="text-sm text-muted">{label}</p>
      <p className="figure text-2xl font-bold tracking-tight text-ink">{value}</p>
      <div className="text-xs text-muted">{note}</div>
    </div>
  );
}

/** Where the gross went: fee, expenses, net, as a bar and as rows. */
function Breakdown({ f }: { f: MonthFigures }) {
  const ownProperty = f.plan?.id === OWN_PROPERTY_PLAN_ID;
  const noFee = f.managementFeeCents === 0;
  const total = Math.max(f.grossCents, f.managementFeeCents + f.ownerExpensesCents + Math.max(f.netCents, 0), 1);
  const parts = [
    { key: 'net', label: 'Net to you', cents: Math.max(f.netCents, 0), dot: 'bg-primary' },
    { key: 'fee', label: 'Management fee', cents: f.managementFeeCents, dot: 'bg-lavender-deep' },
    { key: 'expenses', label: 'Expenses', cents: f.ownerExpensesCents, dot: 'bg-amber-deep' },
  ];
  const feeLabel = ownProperty
    ? 'No management fee (own property)'
    : f.managementFeeBps === null
      ? 'Management fee (no plan)'
      : `${f.plan?.name ?? 'Plan'} fee (${formatBps(f.managementFeeBps)})`;
  return (
    <div className="flex flex-col gap-4">
      <div aria-hidden className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-line-soft">
        {parts
          .filter((p) => p.cents > 0)
          .map((p) => (
            <span key={p.key} className={cx('h-full', p.dot)} style={{ width: `${(p.cents / total) * 100}%` }} />
          ))}
      </div>
      <dl className="grid gap-x-8 text-sm @xl/content:grid-cols-2">
        <Row label="Gross revenue" value={formatCents(f.grossCents)} />
        <Row
          dot="bg-lavender-deep"
          label={feeLabel}
          value={noFee ? '$0.00' : `−${formatCents(f.managementFeeCents)}`}
          muted={noFee}
        />
        <Row dot="bg-amber-deep" label="Expenses" value={`−${formatCents(f.ownerExpensesCents)}`} />
        <Row dot="bg-primary" label="Net to you" value={formatCents(f.netCents)} strong />
      </dl>
    </div>
  );
}

function Row({
  label,
  value,
  dot,
  strong = false,
  muted = false,
}: {
  label: string;
  value: string;
  dot?: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line-soft py-2.5">
      <dt className="flex items-center gap-2 text-muted">
        {dot && <span aria-hidden className={cx('size-2 shrink-0 rounded-full', dot)} />}
        {label}
      </dt>
      <dd
        className={cx(
          'figure',
          strong ? 'text-base font-bold text-ink' : muted ? 'text-muted' : 'font-semibold text-ink',
        )}
      >
        {value}
      </dd>
    </div>
  );
}
