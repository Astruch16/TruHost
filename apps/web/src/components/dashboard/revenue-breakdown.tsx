import { cx } from '../../lib/cx';
import { formatBps } from '../../lib/format';
import { formatCents } from '../../lib/money';
import { ExpensesIcon, FeeIcon, GrossIcon, OwnPropertyIcon } from '../illustrations/statement-icons';
import { StatementLine } from '../statement-line';
import { Pill } from '../ui/pill';

/**
 * Where gross revenue went, read like the owner's statement: a bar of the split, then gross revenue, the management
 * fee and owner-borne expenses (each with its share of gross), and what the owners keep. Cleaning fees (TruHost
 * revenue) are shown separately. Every amount comes from the API; bar widths and shares are proportions of them.
 */
export function RevenueBreakdown({
  breakdown,
  feeRatesBps,
}: {
  breakdown: {
    grossCents: number;
    managementFeeCents: number;
    ownerExpensesCents: number;
    netToOwnersCents: number;
    cleaningFeesCents: number;
  };
  /** The plan rates in force across the scope (one entry when they all share a rate). */
  feeRatesBps: number[];
}) {
  const b = breakdown;
  const net = Math.max(b.netToOwnersCents, 0);
  const whole = Math.max(b.grossCents, b.managementFeeCents + b.ownerExpensesCents + net, 1);
  // Shares of gross, for reading only.
  const share = (cents: number) => (b.grossCents > 0 ? Math.round((cents / b.grossCents) * 100) : null);
  const keep = share(net);
  const noFee = feeRatesBps.length > 0 && feeRatesBps.every((r) => r === 0);
  const feeNote =
    feeRatesBps.length === 0
      ? 'No plan in force'
      : feeRatesBps.length === 1
        ? noFee
          ? 'Own property · no fee'
          : `${formatBps(feeRatesBps[0]!)} of gross`
        : `Rates: ${feeRatesBps.map(formatBps).join(' and ')}`;
  const segments = [
    { key: 'net', label: 'Net to owners', cents: net, className: 'bg-primary' },
    { key: 'fee', label: 'Management fee', cents: b.managementFeeCents, className: 'bg-lavender-deep' },
    { key: 'expenses', label: 'Owner-borne expenses', cents: b.ownerExpensesCents, className: 'bg-amber-deep' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          Gross revenue <strong className="figure ml-1 text-xl font-bold text-ink">{formatCents(b.grossCents)}</strong>
        </p>
        {keep !== null && (
          <Pill tone="sage" className="figure">
            Owners keep {keep}%
          </Pill>
        )}
      </div>
      <div
        role="img"
        aria-label={segments.map((s) => `${s.label} ${formatCents(s.cents)}`).join(', ')}
        className="flex h-3.5 gap-1 overflow-hidden rounded-full bg-line-soft"
      >
        {segments
          .filter((s) => s.cents > 0)
          .map((s) => (
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
          note="Payouts less cleaning fees, this month"
          value={formatCents(b.grossCents)}
        />
        <StatementLine
          icon={noFee ? <OwnPropertyIcon /> : <FeeIcon />}
          label="Management fee"
          note={feeNote}
          value={b.managementFeeCents > 0 ? `−${formatCents(b.managementFeeCents)}` : null}
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
      <div className="flex items-center justify-between gap-4 rounded-inner bg-surface px-4 py-3.5 ring-1 ring-sage-deep/15">
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
      {b.netToOwnersCents < 0 && (
        <p className="text-sm text-danger-deep">Expenses exceed revenue this month: owners would owe the difference.</p>
      )}
      <div className="flex items-center justify-between gap-3 rounded-inner border border-dashed border-line px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-ink">Cleaning fees collected</p>
          <p className="text-xs text-muted">TruHost revenue, not part of owner gross</p>
        </div>
        <span className="figure text-lg font-bold text-ink">{formatCents(b.cleaningFeesCents)}</span>
      </div>
    </div>
  );
}
