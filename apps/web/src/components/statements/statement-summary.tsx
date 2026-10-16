import type { Statement } from '../../lib/api-types';
import { cx } from '../../lib/cx';
import { formatBps } from '../../lib/format';
import { formatCents, splitCents } from '../../lib/money';
import { shortDate } from '../../lib/months';
import { formatSigned } from '../../lib/statements';
import {
  AdjustmentIcon,
  CleaningIcon,
  ExpensesIcon,
  FeeIcon,
  GrossIcon,
  OwnPropertyIcon,
} from '../illustrations/statement-icons';
import { StatementLine } from '../statement-line';

/**
 * The statement's totals, read top to bottom like the PDF: gross, the plan fee, expenses, owner-stay cleaning,
 * adjustments, then the net to the owner on the brand green. Every amount is the API's.
 */
export function StatementSummary({
  statement: s,
  netLabel = 'Net to owner',
}: {
  /** "Net to you" on the owner's own pages. */
  netLabel?: string;
  /** An admin statement, or an owner's released one. */
  statement: Pick<Statement, 'totals' | 'plan' | 'lines' | 'status'> & {
    released: { on: string; paymentReference: string | null } | null;
  };
}) {
  const t = s.totals;
  const noFee = t.managementFeeBps === 0;
  const hasAdjustments = s.lines.some((l) => l.kind === 'ADJUSTMENT');
  const { whole, cents } = splitCents(t.netCents);
  return (
    <div className="flex flex-col gap-4">
      <dl className="flex flex-col rounded-inner bg-ground px-4 pt-4 pb-1">
        <StatementLine
          icon={<GrossIcon />}
          label="Gross revenue"
          note={`Payouts less cleaning fees · ${t.nightsBooked} night${t.nightsBooked === 1 ? '' : 's'}`}
          value={formatCents(t.grossCents)}
        />
        <StatementLine
          icon={noFee ? <OwnPropertyIcon /> : <FeeIcon />}
          label={s.plan ? `${s.plan.name} fee` : 'Management fee'}
          note={
            t.managementFeeBps === null
              ? 'No plan in force'
              : noFee
                ? 'Own property · no fee'
                : `${formatBps(t.managementFeeBps)} of gross revenue`
          }
          value={t.managementFeeCents > 0 ? `−${formatCents(t.managementFeeCents)}` : null}
          empty={noFee ? 'No fee' : 'None'}
        />
        <StatementLine
          icon={<ExpensesIcon />}
          label="Expenses"
          note={t.expensesCents > 0 ? 'Owner-borne, with receipts' : 'None this month'}
          value={t.expensesCents > 0 ? `−${formatCents(t.expensesCents)}` : null}
          empty="None"
        />
        {t.ownerStayCleaningCents > 0 && (
          <StatementLine
            icon={<CleaningIcon />}
            label="Owner-stay cleaning"
            note="Standard cleaning fee after owner stays"
            value={`−${formatCents(t.ownerStayCleaningCents)}`}
          />
        )}
        {(hasAdjustments || t.adjustmentsCents !== 0) && (
          <StatementLine
            icon={<AdjustmentIcon />}
            label="Adjustments"
            note="Corrections, listed below"
            value={formatSigned(t.adjustmentsCents)}
          />
        )}
      </dl>
      <div className="rounded-inner bg-primary px-5 py-4 text-primary-ink">
        <p className="text-xs font-semibold tracking-[0.12em] text-primary-ink-muted uppercase">{netLabel}</p>
        <p
          className={cx(
            'figure mt-1 text-[2rem] leading-tight font-bold tracking-tight',
            t.netCents < 0 && 'text-[#f3b7ae]',
          )}
        >
          {whole}
          <span className="text-[0.6em] text-primary-ink-muted">{cents}</span>
        </p>
        <p className="mt-1 text-sm text-primary-ink-muted">
          {s.released
            ? `Paid ${shortDate(s.released.on)}${s.released.paymentReference ? ` · Ref. ${s.released.paymentReference}` : ''}`
            : t.netCents < 0
              ? 'Expenses exceed revenue: nothing to pay out'
              : s.status === 'DRAFT'
                ? 'Live: changes with the month’s records until finalized'
                : 'Finalized: ready to pay out'}
        </p>
      </div>
    </div>
  );
}
