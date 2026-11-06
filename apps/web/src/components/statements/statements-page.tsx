import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import { CircleAlert, CircleCheck, Clock3, FilePlus2, FileSearch, Send } from 'lucide-react';
import { useApi } from '../../lib/api-context';
import type { StatementMonth, StatementRow } from '../../lib/api-types';
import { cx } from '../../lib/cx';
import { formatCents } from '../../lib/money';
import { monthLabel, shortDate } from '../../lib/months';
import { queries } from '../../lib/queries';
import { STATE_BAR, STATE_LABEL, STATE_ORDER, STATE_TONE } from '../../lib/statements';
import { buttonStyles, updatingStyles } from '../../lib/styles';
import { KpiCard, KpiMoney } from '../dashboard/kpi-card';
import { StatementDocIcon } from '../illustrations/list-icons';
import { ErrorAlert, LoadError } from '../ui/alert';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Confirmation } from '../ui/confirmation';
import { EmptyState } from '../ui/empty-state';
import { MonthStepper } from '../ui/month-stepper';
import { PageHeader } from '../ui/page-header';
import { Pill } from '../ui/pill';
import { Skeleton } from '../ui/skeleton';

/**
 * The admin Statements page: every property's owner statement for a month, with its state and net, totals for the
 * month, and "Generate drafts for all properties". Opening a row goes to the statement.
 */
export function StatementsPage({ month, onMonthChange }: { month: string; onMonthChange: (month: string) => void }) {
  const api = useApi();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const data = useQuery(queries.statementMonth(api, month));
  const [done, setDone] = useState<string | null>(null);

  const generate = useMutation({
    mutationFn: () => unwrap(api.POST('/v1/statements/generate', { body: { month } })),
    onSuccess: (result) => {
      qc.setQueryData(queries.statementMonth(api, month).queryKey, result);
      void qc.invalidateQueries({ queryKey: ['statements'] });
      setDone(
        result.created > 0
          ? `Started ${result.created} draft${result.created === 1 ? '' : 's'} for ${monthLabel(month)}.`
          : result.totals.counts.NOT_STARTED > 0
            ? `No drafts started: ${monthLabel(month)} hasn’t started, or a later month is already finalized.`
            : 'Every property already has a statement for this month.',
      );
    },
  });
  const start = useMutation({
    mutationFn: (propertyId: string) =>
      unwrap(api.POST('/v1/properties/{id}/statements', { params: { path: { id: propertyId } }, body: { month } })),
    onSuccess: async (statement) => {
      await qc.invalidateQueries({ queryKey: ['statements'] });
      void navigate({ to: '/admin/statements/$statementId', params: { statementId: statement.id } });
    },
  });

  const m = data.data;
  const counts = m?.totals.counts;
  const total = m?.items.length ?? 0;
  const changeMonth = (next: string) => {
    setDone(null);
    generate.reset();
    onMonthChange(next);
  };

  return (
    <>
      <PageHeader
        title="Statements"
        description="Each property’s monthly owner statement: review the draft, finalize it, then release the payout."
        actions={
          <Button
            onClick={() => generate.mutate()}
            loading={generate.isPending}
            disabled={!counts || counts.NOT_STARTED === 0}
          >
            <FilePlus2 aria-hidden className="size-4" /> Generate drafts for all properties
          </Button>
        }
      />
      {data.error ? (
        <LoadError what="statements" onRetry={() => void data.refetch()} retrying={data.isFetching} />
      ) : !m ? (
        <div role="status" aria-label="Loading statements" className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 @2xl/content:grid-cols-4 @2xl/content:gap-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-card" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 @2xl/content:grid-cols-4 @2xl/content:gap-4">
            <KpiCard
              label="Net to owners"
              value={<KpiMoney cents={m.totals.netCents} />}
              support={`${total} propert${total === 1 ? 'y' : 'ies'}, ${monthLabel(m.month)}`}
            />
            <KpiCard
              label="To release"
              value={<KpiMoney cents={m.totals.toReleaseCents} />}
              support={
                counts!.FINALIZED === 1 ? '1 finalized, not paid yet' : `${counts!.FINALIZED} finalized, not paid yet`
              }
            />
            <KpiCard
              label="Released"
              value={<KpiMoney cents={m.totals.releasedCents} />}
              support={`${counts!.RELEASED} of ${total} paid out`}
            />
            <KpiCard
              label="Still to finalize"
              value={counts!.DRAFT + counts!.NOT_STARTED}
              support={
                counts!.NOT_STARTED > 0 ? `${counts!.NOT_STARTED} not started yet` : 'Every property has a draft'
              }
            />
          </div>
          {/* The list takes most of the width; the month's progress sits beside it on a wide screen. */}
          <div className="grid grid-cols-1 items-start gap-6 @5xl/content:grid-cols-[minmax(0,1fr)_22rem]">
            <Card
              title="By property"
              description={`${monthLabel(m.month)} · ${total} propert${total === 1 ? 'y' : 'ies'}`}
              actions={<MonthStepper month={month} onChange={changeMonth} />}
            >
              <div className="mb-4 flex flex-col gap-2 empty:hidden">
                {done && <Confirmation>{done}</Confirmation>}
                <ErrorAlert error={generate.error ?? start.error} />
              </div>
              {total === 0 ? (
                <EmptyState title="No properties yet">
                  Statements belong to properties. Add one under Properties, then come back here.
                </EmptyState>
              ) : (
                <div className="@container/list">
                  <ul
                    aria-label={`Statements for ${monthLabel(m.month)}`}
                    aria-busy={data.isPlaceholderData || undefined}
                    className={cx('flex flex-col divide-y divide-line-soft', updatingStyles(data.isPlaceholderData))}
                  >
                    {m.items.map((row) => (
                      <StatementListRow
                        key={row.property.id}
                        row={row}
                        starting={start.isPending && start.variables === row.property.id}
                        onStart={() => start.mutate(row.property.id)}
                      />
                    ))}
                  </ul>
                </div>
              )}
            </Card>
            <MonthProgress month={m} />
          </div>
        </div>
      )}
    </>
  );
}

/**
 * One property's statement for the month: the statement icon, the name with its state and what's next, the three
 * steps (draft, finalized, released), the net with nights and gross under it, and the action. Narrow, the figures and
 * the action drop under the name.
 */
function StatementListRow({ row, starting, onStart }: { row: StatementRow; starting: boolean; onStart: () => void }) {
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 py-4 first:pt-0 last:pb-0 @2xl/list:grid-cols-[auto_minmax(0,1fr)_auto_9.5rem_6.5rem]">
      <StatementDocIcon size={40} />
      <div className="min-w-0">
        <p className="flex min-w-0 items-baseline gap-2">
          {row.statementId ? (
            <Link
              to="/admin/statements/$statementId"
              params={{ statementId: row.statementId }}
              className="truncate font-semibold text-ink hover:underline"
            >
              {row.property.name}
            </Link>
          ) : (
            <span className="truncate font-semibold text-ink">{row.property.name}</span>
          )}
          {row.property.archived && <span className="shrink-0 text-xs text-muted">Archived</span>}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <Pill tone={STATE_TONE[row.state]}>{STATE_LABEL[row.state]}</Pill>
          <RowNote row={row} />
        </div>
      </div>
      <StatementSteps state={row.state} className="hidden @2xl/list:grid" />
      {/* Narrow: one line under the name. Wide: its own two columns. */}
      <div className="col-start-2 flex items-center justify-between gap-4 @2xl/list:contents">
        <div className="@2xl/list:text-right">
          <p className={cx('figure text-base font-semibold', row.netCents < 0 ? 'text-danger-deep' : 'text-ink')}>
            <span className="sr-only">Net to owner: </span>
            {formatCents(row.netCents)}
          </p>
          <p className="figure text-xs text-muted">
            {row.nightsBooked} night{row.nightsBooked === 1 ? '' : 's'} · {formatCents(row.grossCents)} gross
          </p>
        </div>
        <div className="flex justify-end">
          <RowAction row={row} starting={starting} onStart={onStart} />
        </div>
      </div>
    </li>
  );
}

const STEPS = [
  { state: 'DRAFT', label: 'Draft' },
  { state: 'FINALIZED', label: 'Finalized' },
  { state: 'RELEASED', label: 'Released' },
] as const;

/** Draft, finalized, released: a filled step for each the statement has reached, joined by a line. */
function StatementSteps({ state, className }: { state: StatementRow['state']; className?: string }) {
  const reached = STATE_ORDER.indexOf(state) - 1;
  return (
    <ol aria-label="Steps" className={cx('w-48 grid-cols-3 gap-x-1', className)}>
      {STEPS.map((s, i) => {
        const done = i <= reached;
        return (
          <li key={s.state} className="text-center first:text-left last:text-right">
            <span aria-hidden className={cx('block h-1.5 rounded-full', done ? STATE_BAR[state] : 'bg-line')} />
            <span className={cx('mt-1.5 block text-[11px]', i === reached ? 'font-semibold text-ink' : 'text-muted')}>
              {s.label}
              <span className="sr-only">{done ? ': done' : ': not yet'}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Where the month's statements are: a bar split by state, the count in each, and what's left to do. Counts and sums
 * of what the API returned; nothing is computed here.
 */
function MonthProgress({ month: m }: { month: StatementMonth }) {
  const total = m.items.length;
  const counts = m.totals.counts;
  const blockers = m.items.reduce((n, r) => n + r.blockers, 0);
  const pending = m.items.reduce((n, r) => n + r.pendingPayouts, 0);
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const next: { key: string; icon: ReactNode; text: string }[] = [];
  if (counts.NOT_STARTED > 0) {
    next.push({
      key: 'start',
      icon: <FilePlus2 aria-hidden className="size-4 text-muted" />,
      text: `Start ${plural(counts.NOT_STARTED, 'draft')}`,
    });
  }
  if (blockers > 0) {
    next.push({
      key: 'fix',
      icon: <CircleAlert aria-hidden className="size-4 text-danger-deep" />,
      text: `Fix ${plural(blockers, 'issue')} before finalizing`,
    });
  }
  if (pending > 0) {
    next.push({
      key: 'payouts',
      icon: <Clock3 aria-hidden className="size-4 text-amber-deep" />,
      text: `${plural(pending, 'payout')} not entered yet`,
    });
  }
  if (counts.DRAFT > 0) {
    next.push({
      key: 'review',
      icon: <FileSearch aria-hidden className="size-4 text-lavender-mid" />,
      text: `Review and finalize ${plural(counts.DRAFT, 'draft')}`,
    });
  }
  if (counts.FINALIZED > 0) {
    next.push({
      key: 'release',
      icon: <Send aria-hidden className="size-4 text-amber-mid" />,
      text: `Release ${plural(counts.FINALIZED, 'payout')}`,
    });
  }

  return (
    <Card title="Month progress" description={`Where ${monthLabel(m.month)}’s statements are.`}>
      {total === 0 ? (
        <p className="text-sm text-muted">Nothing to track until there’s a property.</p>
      ) : (
        // Below the list (narrower screens) the card is wide, so the counts go on one row.
        <div className="@container/progress">
          <div
            role="img"
            aria-label={STATE_ORDER.map((s) => `${counts[s]} ${STATE_LABEL[s].toLowerCase()}`).join(', ')}
            className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-ground"
          >
            {STATE_ORDER.filter((s) => counts[s] > 0).map((s) => (
              <span key={s} className={STATE_BAR[s]} style={{ flexGrow: counts[s] }} />
            ))}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-2 @xl/progress:grid-cols-4">
            {STATE_ORDER.map((s) => (
              <div key={s} className="rounded-inner border border-line-soft bg-ground/60 px-3 py-2.5">
                <dt className="flex items-center gap-1.5 text-xs text-muted">
                  <span aria-hidden className={cx('size-2 rounded-full', STATE_BAR[s])} />
                  {STATE_LABEL[s]}
                </dt>
                <dd className="figure mt-0.5 text-xl font-semibold text-ink">{counts[s]}</dd>
              </div>
            ))}
          </dl>
          <h3 className="mt-5 mb-2 text-sm font-semibold text-ink">Up next</h3>
          {next.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-sage-deep">
              <CircleCheck aria-hidden className="size-4" /> Every statement is paid out.
            </p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm text-ink">
              {next.map((n) => (
                <li key={n.key} className="flex items-center gap-2.5">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ground">{n.icon}</span>
                  {n.text}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-5 border-t border-line-soft pt-4 text-xs leading-relaxed text-muted">
            Drafts and months not started show live figures; finalized and released statements show what was issued.
          </p>
        </div>
      )}
    </Card>
  );
}

function RowNote({ row }: { row: StatementRow }) {
  if (row.state === 'RELEASED' && row.releasedOn) {
    return <span className="text-sm whitespace-nowrap text-muted">Paid {shortDate(row.releasedOn)}</span>;
  }
  if (row.state === 'FINALIZED') return <span className="text-sm whitespace-nowrap text-muted">Ready to release</span>;
  const notes = [];
  if (row.blockers > 0) {
    notes.push(
      <span key="b" className="inline-flex items-center gap-1 text-danger-deep">
        <CircleAlert aria-hidden className="size-3.5" />
        {row.blockers} to fix
      </span>,
    );
  }
  if (row.pendingPayouts > 0) {
    notes.push(
      <span key="p" className="inline-flex items-center gap-1 text-amber-deep">
        <Clock3 aria-hidden className="size-3.5" />
        {row.pendingPayouts} payout{row.pendingPayouts === 1 ? '' : 's'} pending
      </span>,
    );
  }
  if (notes.length === 0) {
    return (
      <span className="text-sm whitespace-nowrap text-muted">
        {row.state === 'DRAFT' ? 'Ready to finalize' : 'No draft yet'}
      </span>
    );
  }
  return <span className="flex flex-wrap gap-x-3 gap-y-1 text-sm font-medium whitespace-nowrap">{notes}</span>;
}

function RowAction({ row, starting, onStart }: { row: StatementRow; starting: boolean; onStart: () => void }) {
  if (!row.statementId) {
    return (
      <Button variant="secondary" size="sm" loading={starting} onClick={onStart}>
        Start draft
      </Button>
    );
  }
  const label = row.state === 'DRAFT' ? 'Review' : row.state === 'FINALIZED' ? 'Release' : 'View';
  return (
    <Link
      to="/admin/statements/$statementId"
      params={{ statementId: row.statementId }}
      // What needs doing (review, release) stands out; a paid-out statement is only there to look at.
      className={buttonStyles({ variant: row.state === 'RELEASED' ? 'quiet' : 'primary', size: 'sm' })}
      aria-label={`${label}: ${row.property.name}`}
    >
      {label}
    </Link>
  );
}
