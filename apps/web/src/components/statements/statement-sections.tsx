import type { ReactNode } from 'react';
import { FileText, Plus } from 'lucide-react';
import type { Statement, StatementLine } from '../../lib/api-types';
import { cx } from '../../lib/cx';
import { categoryLabel, channelLabel } from '../../lib/format';
import { formatCents } from '../../lib/money';
import { monthLabel, shortDate } from '../../lib/months';
import { formatSigned, shortDay, stayDates, stayNights } from '../../lib/statements';
import { BookingsIllustration } from '../illustrations/bookings';
import { ExpensesIllustration } from '../illustrations/expenses';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { EmptyState } from '../ui/empty-state';
import { Pill } from '../ui/pill';

/** One line of a section: what it is on the left, the amount on the right (stacks well on a phone). */
function Row({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start justify-between gap-4 border-b border-line py-3 first:pt-0 last:border-b-0 last:pb-0">
      {children}
    </li>
  );
}

const lines = (s: Pick<Statement, 'lines'>, kind: StatementLine['kind']) => s.lines.filter((l) => l.kind === kind);

/** Guest stays: dates, guest and channel, nights in the month (with the split when a stay crosses a month end). */
export function StaysSection({
  statement: s,
  description,
}: {
  statement: Pick<Statement, 'lines' | 'month'>;
  description?: string;
}) {
  const stays = lines(s, 'STAY');
  return (
    <Card
      title="Stays"
      description={
        description ??
        `Each guest stay’s owner gross: its payout less the cleaning fee, per night in ${monthLabel(s.month)}.`
      }
    >
      {stays.length === 0 ? (
        <EmptyState size="compact" illustration={<BookingsIllustration />} title="No guest stays">
          Nothing was booked this month.
        </EmptyState>
      ) : (
        <ul className="flex flex-col">
          {stays.map((l) => (
            <Row key={l.bookingId}>
              <div className="min-w-0">
                <p className="font-medium whitespace-nowrap text-ink">{stayDates(l.date, l.endDate!)}</p>
                <p className="text-xs text-muted">
                  {[l.channel ? channelLabel(l.channel) : null, l.guestName, stayNights(l, s.month)]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {l.payoutPending && (
                  <span className="mt-1 inline-block">
                    <Pill tone="amber">Payout not entered</Pill>
                  </span>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="figure font-semibold text-ink">{formatCents(l.amountCents)}</p>
                {!l.cancelled && l.nights !== l.totalNights && l.stayGrossCents !== null && (
                  <p className="figure text-xs whitespace-nowrap text-muted">
                    of {formatCents(l.stayGrossCents)} for the stay
                  </p>
                )}
              </div>
            </Row>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Owner stays checking out this month, each charged the property's standard cleaning fee. */
export function OwnerStaysSection({ statement: s }: { statement: Pick<Statement, 'lines'> }) {
  const cleanings = lines(s, 'OWNER_STAY_CLEANING');
  if (cleanings.length === 0) return null;
  return (
    <Card title="Owner stays" description="The standard cleaning fee for the turnover after each owner stay.">
      <ul className="flex flex-col">
        {cleanings.map((l) => (
          <li
            key={l.bookingId}
            className="flex items-center justify-between gap-4 border-b border-line py-3 first:pt-0 last:border-b-0 last:pb-0"
          >
            <div>
              <p className="font-medium text-ink">{stayDates(l.date, l.endDate!)}</p>
              <p className="text-xs text-muted">Cleaning after the owner’s stay</p>
            </div>
            <span className="figure font-semibold text-ink">{formatSigned(l.amountCents)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Owner-borne expenses purchased this month, with their receipts. */
export function ExpensesSection({
  statement: s,
  onViewReceipt,
}: {
  statement: Pick<Statement, 'lines'> & { blockers?: Statement['blockers'] };
  onViewReceipt: (fileId: string) => void;
}) {
  const expenses = lines(s, 'EXPENSE');
  const missing = new Set((s.blockers ?? []).flatMap((b) => b.expenseIds ?? []));
  return (
    <Card title="Expenses" description="Owner-borne purchases, dated by receipt.">
      {expenses.length === 0 ? (
        <EmptyState size="compact" illustration={<ExpensesIllustration />} title="No expenses">
          Nothing was bought for this property this month.
        </EmptyState>
      ) : (
        <ul className="flex flex-col">
          {expenses.map((l) => (
            <Row key={l.expenseId}>
              <div className="min-w-0">
                <p className="font-medium text-ink">{l.description}</p>
                <p className="text-xs text-muted">
                  {[shortDate(l.date), l.detail, l.category ? categoryLabel(l.category) : null]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <span className="mt-1 -ml-2 flex flex-wrap items-center gap-1 empty:hidden">
                  {(l.receipts ?? []).map((r) => (
                    <Button key={r.id} variant="quiet" size="sm" onClick={() => onViewReceipt(r.fileId)}>
                      <FileText aria-hidden className="size-4" />
                      <span className="sr-only">View receipt</span>
                      <span className="max-w-40 truncate">{r.filename ?? 'Receipt'}</span>
                    </Button>
                  ))}
                  {missing.has(l.expenseId!) && (
                    <span className="ml-2">
                      <Pill tone="danger">Missing receipt</Pill>
                    </span>
                  )}
                </span>
              </div>
              <span className="figure shrink-0 font-semibold whitespace-nowrap text-ink">
                {formatSigned(l.amountCents)}
              </span>
            </Row>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * Adjustments on this statement, voided ones kept (struck through). A draft takes new ones; a finalized statement
 * points corrections to the next month's.
 */
export function AdjustmentsSection({
  statement: s,
  onAdd,
  onVoid,
  onCorrectNextMonth,
  correcting,
}: {
  statement: Statement;
  onAdd: () => void;
  onVoid: (adjustmentId: string) => void;
  onCorrectNextMonth: () => void;
  correcting: boolean;
}) {
  const draft = s.status === 'DRAFT';
  return (
    <Card
      title="Adjustments"
      description={
        draft
          ? 'Corrections to earlier months, credits or charges. Each needs a reason and shows on the owner’s statement.'
          : 'This statement is final. Corrections go on the next month’s statement.'
      }
      actions={
        draft ? (
          <Button variant="secondary" size="sm" onClick={onAdd}>
            <Plus aria-hidden className="size-4" /> Add adjustment
          </Button>
        ) : (
          <Button variant="secondary" size="sm" loading={correcting} onClick={onCorrectNextMonth}>
            <Plus aria-hidden className="size-4" /> Add a correction next month
          </Button>
        )
      }
    >
      {s.adjustments.length === 0 ? (
        <p className="text-sm text-muted">No adjustments.</p>
      ) : (
        <ul className="flex flex-col">
          {s.adjustments.map((a) => (
            <li
              key={a.id}
              className="flex items-start justify-between gap-4 border-b border-line py-3 first:pt-0 last:border-b-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className={cx('font-medium', a.voidedAt ? 'text-muted line-through' : 'text-ink')}>{a.reason}</p>
                <p className="text-xs text-muted">
                  {[
                    a.corrects ? `Corrects ${monthLabel(a.corrects.month)}` : null,
                    `Added by ${a.createdBy.firstName} on ${shortDay(a.createdAt)}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {a.voidedAt && <p className="mt-1 text-xs text-muted">Voided: {a.voidReason}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={cx(
                    'figure font-semibold',
                    a.voidedAt ? 'text-muted line-through' : a.amountCents < 0 ? 'text-danger-deep' : 'text-sage-deep',
                  )}
                >
                  {formatSigned(a.amountCents)}
                </span>
                {draft && !a.voidedAt && (
                  <Button variant="quiet" size="sm" onClick={() => onVoid(a.id)} aria-label={`Void: ${a.reason}`}>
                    Void
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
