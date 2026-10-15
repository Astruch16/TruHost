import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import { ArrowLeft, CircleAlert, Clock3, Download, Eye, Lock, Send } from 'lucide-react';
import { useApi } from '../../lib/api-context';
import type { Statement } from '../../lib/api-types';
import { cx } from '../../lib/cx';
import { channelLabel } from '../../lib/format';
import { addMonths, monthLabel } from '../../lib/months';
import { queries } from '../../lib/queries';
import { STATE_LABEL, STATE_TONE, shortDay, stayDates } from '../../lib/statements';
import { openFile } from '../../lib/upload';
import { ErrorAlert, LoadError } from '../ui/alert';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Confirmation } from '../ui/confirmation';
import { PageHeader } from '../ui/page-header';
import { Pill } from '../ui/pill';
import { Skeleton } from '../ui/skeleton';
import { SuccessNotice } from '../ui/success-notice';
import {
  AdjustmentDialog,
  FinalizeDialog,
  PdfPreviewDialog,
  ReleaseDialog,
  VoidAdjustmentDialog,
} from './statement-dialogs';
import { AdjustmentsSection, ExpensesSection, OwnerStaysSection, StaysSection } from './statement-sections';
import { StatementSummary } from './statement-summary';

type Open = 'finalize' | 'release' | 'adjust' | 'preview' | { void: string } | null;

/**
 * One owner statement (admin): its totals beside the stays, owner stays, expenses and adjustments, what blocks it,
 * and the actions for where it stands (finalize a draft, release a finalized one, open a released one's PDF).
 * `correcting` is a finalized statement whose correction the admin came here to add (opens the adjustment form).
 */
export function StatementDetail({ statementId, correcting }: { statementId: string; correcting?: string }) {
  const api = useApi();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const query = useQuery(queries.statement(api, statementId));
  const [open, setOpen] = useState<Open>(correcting ? 'adjust' : null);
  const [milestone, setMilestone] = useState<'finalized' | 'released' | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  const correctNextMonth = useMutation({
    mutationFn: (s: Statement) =>
      unwrap(
        api.POST('/v1/properties/{id}/statements', {
          params: { path: { id: s.property.id } },
          body: { month: addMonths(s.month, 1) },
        }),
      ),
    onSuccess: async (next, s) => {
      await qc.invalidateQueries({ queryKey: ['statements'] });
      void navigate({
        to: '/admin/statements/$statementId',
        params: { statementId: next.id },
        search: { correcting: s.id },
      });
    },
    onError: setActionError,
  });

  if (query.error) {
    return <LoadError what="this statement" onRetry={() => void query.refetch()} retrying={query.isFetching} />;
  }
  const s = query.data;
  if (!s) {
    return (
      <div role="status" aria-label="Loading statement" className="flex flex-col gap-6">
        <Skeleton className="h-16 w-2/3 rounded-inner" />
        <div className="grid gap-6 @5xl/content:grid-cols-[minmax(0,1fr)_24rem]">
          <Skeleton className="h-96 rounded-card" />
          <Skeleton className="h-96 rounded-card" />
        </div>
      </div>
    );
  }

  /** A mutation returned the statement as it now stands: show it, and refresh the month's list. */
  const done = (next: Statement, what?: 'finalized' | 'released') => {
    qc.setQueryData(queries.statement(api, statementId).queryKey, next);
    void qc.invalidateQueries({ queryKey: ['statements', 'month'] });
    setOpen(null);
    if (what) setMilestone(what);
  };
  const month = monthLabel(s.month);
  const voiding = typeof open === 'object' && open !== null ? s.adjustments.find((a) => a.id === open.void) : undefined;

  return (
    <>
      <Link
        to="/admin/statements"
        search={{ month: s.month }}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" /> All statements for {month}
      </Link>
      <PageHeader
        eyebrow={`Owner statement · ${month}`}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {s.property.name}
            <Pill tone={STATE_TONE[s.status]}>{STATE_LABEL[s.status]}</Pill>
          </span>
        }
        description={
          s.owners.length === 0
            ? 'No owner on this property yet.'
            : `${s.owners.length > 1 ? 'Owners' : 'Owner'}: ${s.owners.map((o) => `${o.firstName} ${o.lastName}`).join(', ')}`
        }
        actions={
          <>
            {s.can.preview && (
              <Button variant="secondary" onClick={() => setOpen('preview')}>
                <Eye aria-hidden className="size-4" /> Preview PDF
              </Button>
            )}
            {s.status === 'DRAFT' && (
              <Button onClick={() => setOpen('finalize')} disabled={!s.can.finalize}>
                <Lock aria-hidden className="size-4" /> Finalize
              </Button>
            )}
            {s.status === 'FINALIZED' && (
              <Button onClick={() => setOpen('release')} disabled={!s.can.release}>
                <Send aria-hidden className="size-4" /> Release payout
              </Button>
            )}
            {s.pdf && (
              <Button onClick={() => void openFile(api, s.pdf!.fileId).catch(setActionError)}>
                <Download aria-hidden className="size-4" /> Statement PDF
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-6">
        {milestone === 'finalized' && (
          <SuccessNotice title={`${month} is finalized for ${s.property.name}`}>
            Its bookings and expenses are locked. Release the payout once you’ve sent it.
          </SuccessNotice>
        )}
        {milestone === 'released' && (
          <Confirmation>Released. The PDF is stored and the statement is final.</Confirmation>
        )}
        <ErrorAlert error={actionError} />
        {s.status === 'DRAFT' && <DraftNotes statement={s} />}

        <div className="grid items-start gap-6 @5xl/content:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="flex min-w-0 flex-col gap-6">
            <StaysSection statement={s} />
            <OwnerStaysSection statement={s} />
            <ExpensesSection statement={s} onViewReceipt={(id) => void openFile(api, id).catch(setActionError)} />
            <AdjustmentsSection
              statement={s}
              onAdd={() => setOpen('adjust')}
              onVoid={(id) => setOpen({ void: id })}
              onCorrectNextMonth={() => correctNextMonth.mutate(s)}
              correcting={correctNextMonth.isPending}
            />
          </div>
          <div className="order-first flex flex-col gap-6 @5xl/content:sticky @5xl/content:top-6 @5xl/content:order-none">
            <Card title="Summary">
              <StatementSummary statement={s} />
            </Card>
            <Card title="Progress">
              <Progress statement={s} />
            </Card>
          </div>
        </div>
      </div>

      {open === 'finalize' && (
        <FinalizeDialog statement={s} open onOpenChange={() => setOpen(null)} onDone={(n) => done(n, 'finalized')} />
      )}
      {open === 'release' && (
        <ReleaseDialog statement={s} open onOpenChange={() => setOpen(null)} onDone={(n) => done(n, 'released')} />
      )}
      {open === 'adjust' && s.status === 'DRAFT' && (
        <AdjustmentDialog
          statement={s}
          open
          onOpenChange={() => setOpen(null)}
          onDone={(n) => done(n)}
          initialCorrects={correcting && s.correctable.some((c) => c.id === correcting) ? correcting : ''}
        />
      )}
      {voiding && (
        <VoidAdjustmentDialog adjustment={voiding} open onOpenChange={() => setOpen(null)} onDone={(n) => done(n)} />
      )}
      {open === 'preview' && <PdfPreviewDialog statement={s} open onOpenChange={() => setOpen(null)} />}
    </>
  );
}

/** What stands between a draft and finalizing it, and the stays still waiting on a payout. */
function DraftNotes({ statement: s }: { statement: Statement }) {
  if (s.blockers.length === 0 && s.pendingPayouts.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-inner bg-sage-tint px-4 py-3 text-sm text-sage-deep">
        <Lock aria-hidden className="size-4 shrink-0" />
        Ready to finalize. Figures follow the month’s records until you do.
      </p>
    );
  }
  return (
    <div className="grid gap-3 @3xl/content:grid-cols-2">
      {s.blockers.length > 0 && (
        <div role="alert" className="rounded-inner border border-danger-line bg-danger-tint px-4 py-3 text-sm">
          <p className="flex items-center gap-2 font-semibold text-danger-deep">
            <CircleAlert aria-hidden className="size-4" /> Before this can be finalized
          </p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-9 text-ink">
            {s.blockers.map((b) => (
              <li key={b.code}>
                {b.message}{' '}
                {b.code === 'EARLIER_DRAFT' && b.statementId && (
                  <Link
                    to="/admin/statements/$statementId"
                    params={{ statementId: b.statementId }}
                    className="font-semibold text-primary hover:underline"
                  >
                    Open it
                  </Link>
                )}
                {b.code === 'MISSING_RECEIPTS' && (
                  <Link
                    to="/admin/expenses"
                    search={{ month: s.month }}
                    className="font-semibold text-primary hover:underline"
                  >
                    Add receipts
                  </Link>
                )}
                {b.code === 'NO_PLAN' && (
                  <Link
                    to="/admin/properties/$propertyId"
                    params={{ propertyId: s.property.id }}
                    className="font-semibold text-primary hover:underline"
                  >
                    Assign a plan
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {s.pendingPayouts.length > 0 && (
        <div className="rounded-inner border border-amber-light bg-amber-tint px-4 py-3 text-sm">
          <p className="flex items-center gap-2 font-semibold text-amber-deep">
            <Clock3 aria-hidden className="size-4" />
            {s.pendingPayouts.length === 1 ? 'A stay is' : `${s.pendingPayouts.length} stays are`} waiting on a payout
          </p>
          <ul className="mt-2 flex flex-col gap-1 pl-6 text-ink">
            {s.pendingPayouts.map((p) => (
              <li key={p.bookingId}>
                {stayDates(p.checkInDate, p.checkOutDate)} · {channelLabel(p.channel)}
                {p.guestName ? ` · ${p.guestName}` : ''}
              </li>
            ))}
          </ul>
          <p className="mt-2 pl-6 text-xs text-amber-deep">
            Enter payouts on the Bookings page. Finalizing now counts them at $0 (you’ll be asked to confirm).
          </p>
        </div>
      )}
    </div>
  );
}

/** Draft → Finalized → Released, with who and when. */
function Progress({ statement: s }: { statement: Statement }) {
  const name = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`;
  const steps = [
    { label: 'Draft started', done: true, detail: `${shortDay(s.created.at)} · ${name(s.created.by)}` },
    {
      label: 'Finalized',
      done: Boolean(s.finalized),
      detail: s.finalized ? `${shortDay(s.finalized.at)} · ${name(s.finalized.by)}` : 'Locks the month’s records',
    },
    {
      label: 'Released',
      done: Boolean(s.released),
      detail: s.released
        ? `Paid ${shortDay(`${s.released.on}T12:00:00Z`)}${s.released.paymentReference ? ` · Ref. ${s.released.paymentReference}` : ''}`
        : 'Records the payout and stores the PDF',
    },
  ];
  return (
    <ol className="flex flex-col">
      {steps.map((step, i) => (
        <li key={step.label} className="relative flex gap-3 pb-5 last:pb-0">
          {i < steps.length - 1 && (
            <span
              aria-hidden
              className={cx('absolute top-6 bottom-0 left-[11px] w-0.5', steps[i + 1]!.done ? 'bg-primary' : 'bg-line')}
            />
          )}
          <span
            aria-hidden
            className={cx(
              'relative grid size-6 shrink-0 place-items-center rounded-full border-2 text-[11px] font-bold',
              step.done ? 'border-primary bg-primary text-primary-ink' : 'border-line bg-surface text-muted',
            )}
          >
            {step.done ? '✓' : i + 1}
          </span>
          <div className="min-w-0">
            <p className={cx('text-sm font-semibold', step.done ? 'text-ink' : 'text-muted')}>
              {step.label}
              <span className="sr-only">{step.done ? ' (done)' : ' (not yet)'}</span>
            </p>
            <p className="text-xs text-muted">{step.detail}</p>
          </div>
        </li>
      ))}
      {s.pdf && (
        <li className="mt-4 rounded-inner bg-ground px-3 py-2 text-xs break-all text-muted">
          PDF SHA-256 <span className="font-mono text-ink">{s.pdf.sha256}</span>
        </li>
      )}
    </ol>
  );
}
