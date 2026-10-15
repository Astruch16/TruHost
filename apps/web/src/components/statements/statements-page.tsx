import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import { CircleAlert, Clock3, FilePlus2 } from 'lucide-react';
import { useApi } from '../../lib/api-context';
import type { StatementRow } from '../../lib/api-types';
import { formatCents } from '../../lib/money';
import { monthLabel, shortDate } from '../../lib/months';
import { queries } from '../../lib/queries';
import { STATE_LABEL, STATE_TONE } from '../../lib/statements';
import { updatingStyles } from '../../lib/styles';
import { KpiCard, KpiMoney } from '../dashboard/kpi-card';
import { ErrorAlert, LoadError } from '../ui/alert';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Confirmation } from '../ui/confirmation';
import { EmptyState } from '../ui/empty-state';
import { MonthStepper } from '../ui/month-stepper';
import { PageHeader } from '../ui/page-header';
import { Pill } from '../ui/pill';
import { Skeleton } from '../ui/skeleton';
import { Table, TBody, Td, Th, THead, Tr } from '../ui/table';

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
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <MonthStepper month={month} onChange={changeMonth} />
              {done && <Confirmation>{done}</Confirmation>}
            </div>
            <div className="mb-3 flex flex-col gap-2 empty:hidden">
              <ErrorAlert error={generate.error ?? start.error} />
            </div>
            {total === 0 ? (
              <EmptyState title="No properties yet">
                Statements belong to properties. Add one under Properties, then come back here.
              </EmptyState>
            ) : (
              <Table aria-busy={data.isPlaceholderData || undefined} className={updatingStyles(data.isPlaceholderData)}>
                <THead>
                  <tr>
                    <Th>Property</Th>
                    <Th>Status</Th>
                    <Th align="right">Nights</Th>
                    <Th align="right">Gross</Th>
                    <Th align="right">Net to owner</Th>
                    <Th>
                      <span className="sr-only">Notes</span>
                    </Th>
                    <Th align="right">
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </THead>
                <TBody>
                  {m.items.map((row) => (
                    <Tr key={row.property.id} interactive={Boolean(row.statementId)}>
                      <Td className="font-medium">
                        {row.statementId ? (
                          <Link
                            to="/admin/statements/$statementId"
                            params={{ statementId: row.statementId }}
                            className="text-ink hover:underline"
                          >
                            {row.property.name}
                          </Link>
                        ) : (
                          row.property.name
                        )}
                        {row.property.archived && <span className="ml-2 text-xs text-muted">Archived</span>}
                      </Td>
                      <Td>
                        <Pill tone={STATE_TONE[row.state]}>{STATE_LABEL[row.state]}</Pill>
                      </Td>
                      <Td align="right" className="figure">
                        {row.nightsBooked}
                      </Td>
                      <Td align="right" className="figure">
                        {formatCents(row.grossCents)}
                      </Td>
                      <Td
                        align="right"
                        className={row.netCents < 0 ? 'figure font-semibold text-danger-deep' : 'figure font-semibold'}
                      >
                        {formatCents(row.netCents)}
                      </Td>
                      <Td>
                        <RowNote row={row} />
                      </Td>
                      <Td align="right">
                        <RowAction
                          row={row}
                          starting={start.isPending && start.variables === row.property.id}
                          onStart={() => start.mutate(row.property.id)}
                        />
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
            {total > 0 && (
              <p className="mt-4 text-xs text-muted">
                Drafts and months not started show live figures; finalized and released statements show what was issued.
              </p>
            )}
          </Card>
        </div>
      )}
    </>
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
      className="inline-flex min-h-8 items-center rounded-full px-3 text-sm font-semibold text-primary hover:bg-ground"
      aria-label={`${label}: ${row.property.name}`}
    >
      {label}
    </Link>
  );
}
