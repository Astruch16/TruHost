import { cx } from '../../lib/cx';
import { feeNote, plural } from '../../lib/dashboard-format';
import { formatCents } from '../../lib/money';
import { ExpensesIcon, FeeIcon, GrossIcon, OwnPropertyIcon } from '../illustrations/statement-icons';
import { StatementLine } from '../statement-line';
import { Pill } from '../ui/pill';

/**
 * Where gross revenue went, read like the owner's statement: a bar of the split, then gross revenue, the management
 * fee and owner-borne expenses (each with its share of gross), and what the owners keep. Cleaning fees (TruHost
 * revenue) are shown separately. Every amount comes from the API; bar widths and shares are proportions of them.
 *
 * While stays in the month are waiting on their payout, net to owners isn't final: instead of a figure (which could be
 * negative only because revenue hasn't been entered yet) it says what's counted so far. The "owners would owe"
 * warning shows only once every stay's payout is in and the month is still negative.
 *
 * Wide enough, it reads in two columns: the split on the left, the result on the right.
 */
export function RevenueBreakdown({
  breakdown,
  properties,
  pendingStays,
}: {
  breakdown: {
    grossCents: number;
    managementFeeCents: number;
    ownerExpensesCents: number;
    netToOwnersCents: number;
    cleaningFeesCents: number;
  };
  /** The properties in scope with the plan rate in force (null without a plan). */
  properties: { name: string; feeRateBps: number | null }[];
  /** Stays in the month still waiting on their payout. */
  pendingStays: number;
}) {
  const b = breakdown;
  const pending = pendingStays > 0;
  const net = Math.max(b.netToOwnersCents, 0);
  const whole = Math.max(b.grossCents, b.managementFeeCents + b.ownerExpensesCents + net, 1);
  // Shares of gross, for reading only.
  const share = (cents: number) => (b.grossCents > 0 ? Math.round((cents / b.grossCents) * 100) : null);
  const keep = pending ? null : share(net);
  const rated = properties.filter((p) => p.feeRateBps !== null);
  const noFee = rated.length > 0 && rated.every((p) => p.feeRateBps === 0);
  // With no gross there is nothing to split: the bar stays empty rather than filling with expenses.
  const segments =
    b.grossCents === 0
      ? []
      : [
          { key: 'net', label: 'Net to owners', cents: net, className: 'bg-primary' },
          { key: 'fee', label: 'Management fee', cents: b.managementFeeCents, className: 'bg-lavender-deep' },
          { key: 'expenses', label: 'Owner-borne expenses', cents: b.ownerExpensesCents, className: 'bg-blue-light' },
        ].filter((s) => s.cents > 0);

  return (
    <div className="@container/breakdown">
      <div className="grid gap-4 @3xl/breakdown:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] @3xl/breakdown:gap-6">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">
              Gross revenue{' '}
              <strong className="figure ml-1 text-xl font-bold text-ink">{formatCents(b.grossCents)}</strong>
            </p>
            {keep !== null && (
              <Pill tone="sage" className="figure">
                Owners keep {keep}%
              </Pill>
            )}
          </div>
          <div
            role="img"
            aria-label={
              segments.length === 0
                ? 'Nothing to split yet'
                : segments.map((s) => `${s.label} ${formatCents(s.cents)}`).join(', ')
            }
            className="flex h-3.5 gap-1 overflow-hidden rounded-full bg-line-soft"
          >
            {segments.map((s) => (
              <span
                key={s.key}
                className={cx('h-full first:rounded-l-full last:rounded-r-full', s.className)}
                style={{ width: `${(s.cents / whole) * 100}%` }}
              />
            ))}
          </div>
          <dl className="flex flex-col rounded-inner bg-ground px-4 pt-4 pb-1">
            <StatementLine
              icon={<GrossIcon />}
              label="Gross revenue"
              note={pending ? 'Payouts entered so far, less cleaning fees' : 'Payouts less cleaning fees, this month'}
              value={formatCents(b.grossCents)}
            />
            <StatementLine
              icon={noFee ? <OwnPropertyIcon /> : <FeeIcon />}
              label="Management fee"
              note={feeNote(properties)}
              value={
                b.managementFeeCents > 0
                  ? `−${formatCents(b.managementFeeCents)}`
                  : rated.length > 0 && !noFee
                    ? formatCents(0)
                    : null
              }
              empty={noFee ? 'No fee' : 'None'}
              share={b.managementFeeCents > 0 ? share(b.managementFeeCents) : null}
            />
            <StatementLine
              icon={<ExpensesIcon />}
              label="Owner-borne expenses"
              note={b.ownerExpensesCents > 0 ? 'Paid from owners’ earnings' : 'None this month'}
              value={b.ownerExpensesCents > 0 ? `−${formatCents(b.ownerExpensesCents)}` : null}
              empty="None"
              share={b.ownerExpensesCents > 0 ? share(b.ownerExpensesCents) : null}
            />
          </dl>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {pending ? (
            <div className="flex flex-1 flex-col justify-center gap-2 rounded-inner bg-surface px-4 py-3.5 ring-1 ring-line">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-ink">Net to owners</p>
                <Pill tone="amber">Not final yet</Pill>
              </div>
              <p className="text-sm text-muted">
                <strong className="figure block text-2xl font-bold tracking-tight text-ink">
                  {formatCents(b.grossCents)}
                </strong>{' '}
                counted so far · {plural(pendingStays, 'stay', 'stays')} waiting on payout ·{' '}
                <span className="figure">{formatCents(b.ownerExpensesCents)}</span> expenses
              </p>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-between gap-4 rounded-inner bg-surface px-4 py-3.5 ring-1 ring-sage-deep/15">
              <div>
                <p className="font-semibold text-ink">Net to owners</p>
                <p className="text-xs text-muted">Gross, less the fee and expenses</p>
              </div>
              <p
                className={cx(
                  'figure text-2xl font-bold tracking-tight',
                  b.netToOwnersCents < 0 ? 'text-danger-deep' : 'text-sage-deep',
                )}
              >
                {formatCents(b.netToOwnersCents)}
              </p>
            </div>
          )}
          {!pending && b.netToOwnersCents < 0 && (
            <p className="text-sm text-danger-deep">
              Expenses exceed revenue this month: owners would owe the difference.
            </p>
          )}
          <div className="flex items-center justify-between gap-3 rounded-inner border border-dashed border-line px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-ink">Cleaning fees collected</p>
              <p className="text-xs text-muted">TruHost revenue, not part of owner gross</p>
            </div>
            <span className="figure text-lg font-bold text-ink">{formatCents(b.cleaningFeesCents)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
