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
import { ExpensesIcon, FeeIcon, GrossIcon, OwnPropertyIcon } from '../illustrations/statement-icons';
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
      {/* The headline tile: olive green, set apart from the white tiles and in the portal's earthy greens. */}
      <div className="flex flex-col justify-between gap-3 rounded-inner bg-olive p-5 text-white @xl/content:row-span-2">
        <p className="text-sm font-semibold">Net to you</p>
        <p className="figure text-4xl font-bold tracking-tight">{formatCents(f.netCents)}</p>
        <p className="text-sm text-white/85">
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

/**
 * Where the gross went, read top to bottom like a statement: gross revenue, then each deduction (with what it is and
 * its share of gross), then what the owner keeps. A bar above shows the same split. Zero deductions say so in words
 * ("None", "No fee") instead of "−$0.00".
 */
function Breakdown({ f }: { f: MonthFigures }) {
  const ownProperty = f.plan?.id === OWN_PROPERTY_PLAN_ID;
  const total = Math.max(f.grossCents, f.managementFeeCents + f.ownerExpensesCents + Math.max(f.netCents, 0), 1);
  // Shares of gross, for reading only (the amounts themselves come from the API).
  const share = (cents: number) => (f.grossCents > 0 ? Math.round((cents / f.grossCents) * 100) : null);
  const keep = share(Math.max(f.netCents, 0));
  const segments = [
    { key: 'net', cents: Math.max(f.netCents, 0), className: 'bg-primary' },
    { key: 'fee', cents: f.managementFeeCents, className: 'bg-lavender-deep' },
    { key: 'expenses', cents: f.ownerExpensesCents, className: 'bg-amber-deep' },
  ].filter((s) => s.cents > 0);
  const feeNote = ownProperty
    ? 'Own property · no fee'
    : f.managementFeeBps === null
      ? 'No plan in force'
      : `${f.plan?.name ?? 'Plan'} · ${formatBps(f.managementFeeBps)} of gross`;

  return (
    <section
      aria-labelledby="where-it-went"
      className="flex flex-col gap-4 rounded-inner bg-ground p-4 @2xl/content:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="where-it-went" className="font-semibold text-ink">
          Where it went
        </h3>
        {keep !== null && (
          <span className="figure rounded-full bg-sage-tint px-2.5 py-1 text-xs font-semibold text-sage-deep">
            You keep {keep}%
          </span>
        )}
      </div>
      <div aria-hidden className="flex h-4 gap-1 overflow-hidden rounded-full bg-line">
        {segments.map((s) => (
          <span
            key={s.key}
            className={cx('h-full first:rounded-l-full last:rounded-r-full', s.className)}
            style={{ width: `${(s.cents / total) * 100}%` }}
          />
        ))}
      </div>
      <dl className="flex flex-col">
        <Line
          icon={<GrossIcon />}
          label="Gross revenue"
          note={`${f.stays} stay${f.stays === 1 ? '' : 's'} this month`}
          value={formatCents(f.grossCents)}
        />
        <Line
          icon={ownProperty ? <OwnPropertyIcon /> : <FeeIcon />}
          label="Management fee"
          note={feeNote}
          value={f.managementFeeCents > 0 ? `−${formatCents(f.managementFeeCents)}` : null}
          empty={ownProperty || f.managementFeeBps === 0 ? 'No fee' : 'None'}
          share={f.managementFeeCents > 0 ? share(f.managementFeeCents) : null}
        />
        <Line
          icon={<ExpensesIcon />}
          label="Expenses"
          note={f.ownerExpensesCents > 0 ? 'Paid from your earnings' : 'None this month'}
          value={f.ownerExpensesCents > 0 ? `−${formatCents(f.ownerExpensesCents)}` : null}
          empty="None"
          share={f.ownerExpensesCents > 0 ? share(f.ownerExpensesCents) : null}
        />
      </dl>
      <div className="flex items-center justify-between gap-4 rounded-inner bg-surface px-4 py-3.5 ring-1 ring-sage-deep/15">
        <div>
          <p className="font-semibold text-ink">Net to you</p>
          <p className="text-xs text-muted">Gross, less the fee and expenses</p>
        </div>
        <p
          className={cx(
            'figure text-2xl font-bold tracking-tight',
            f.netCents < 0 ? 'text-danger-deep' : 'text-sage-deep',
          )}
        >
          {formatCents(f.netCents)}
        </p>
      </div>
    </section>
  );
}

/** One line of the statement: its illustration, what it is, and the amount (or a word when there's nothing). */
function Line({
  icon,
  label,
  note,
  value,
  empty = '—',
  share = null,
}: {
  icon: ReactNode;
  label: string;
  note: string;
  value: string | null;
  empty?: string;
  share?: number | null;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-line py-3 first:pt-0 last:border-b-0">
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <dt className="font-medium text-ink">{label}</dt>
        <p className="text-xs text-muted">{note}</p>
      </div>
      <dd className="flex shrink-0 items-center gap-2">
        {/* The share gives way to the amount on narrow screens (the fee's note says it too). */}
        {share !== null && (
          <span className="figure hidden rounded-full bg-surface px-2 py-0.5 text-xs text-muted @md/content:inline">
            {share}%
          </span>
        )}
        {value === null ? (
          <span className="rounded-full bg-surface px-2.5 py-0.5 text-sm font-medium text-muted">{empty}</span>
        ) : (
          <span className="figure font-semibold text-ink">{value}</span>
        )}
      </dd>
    </div>
  );
}
