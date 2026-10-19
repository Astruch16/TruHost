import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { unwrap, type ApiClient } from '@truhost/api-client';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { useApi } from '../../lib/api-context';
import { formatCents } from '../../lib/money';
import { monthLabel, shortDate } from '../../lib/months';
import { queries } from '../../lib/queries';
import { switchingStyles } from '../../lib/styles';
import { formatSigned } from '../../lib/statements';
import { openFile } from '../../lib/upload';
import { CareIllustration } from '../illustrations/care';
import { StatementSummary } from '../statements/statement-summary';
import { ExpensesSection, OwnerStaysSection, StaysSection } from '../statements/statement-sections';
import { ErrorAlert, LoadError } from '../ui/alert';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { EmptyState } from '../ui/empty-state';
import { PageHeader } from '../ui/page-header';
import { Pill } from '../ui/pill';
import { Skeleton } from '../ui/skeleton';

/** Opens the statement's stored PDF (a short-lived signed link from the owner API). */
function usePdf(api: ApiClient) {
  return useMutation({
    mutationFn: async (id: string) => {
      // Open the tab synchronously (popup blockers), then point it at the link.
      const tab = window.open('', '_blank');
      try {
        const { url } = await unwrap(api.GET('/v1/owner/statements/{id}/pdf', { params: { path: { id } } }));
        if (tab) tab.location.href = url;
        else window.location.href = url;
      } catch (e) {
        tab?.close();
        throw e;
      }
    },
  });
}

/** Released statements, newest first, for the properties the owner sees in the switcher. */
export function OwnerStatementsPage({ propertyId }: { propertyId: string | null }) {
  const api = useApi();
  const list = useQuery(queries.ownerStatements(api, propertyId));
  const pdf = usePdf(api);
  const items = list.data?.items ?? [];
  const many = new Set(items.map((s) => s.property.id)).size > 1;

  return (
    <>
      <PageHeader
        title="Statements"
        description="Your monthly statements, once TruHost has released the payout. Each one has a PDF for your records."
      />
      <ErrorAlert error={pdf.error} />
      {list.error ? (
        <LoadError what="your statements" onRetry={() => void list.refetch()} retrying={list.isFetching} />
      ) : !list.data ? (
        <div role="status" aria-label="Loading statements" className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-card" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className={switchingStyles(list.isPlaceholderData)}>
          <EmptyState title="No statements yet">
            Your first statement arrives after the month ends, once TruHost has checked every payout and receipt. You’ll
            get an email when it’s ready.
          </EmptyState>
        </Card>
      ) : (
        <Card className={switchingStyles(list.isPlaceholderData)}>
          <ul className="flex flex-col">
            {items.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line py-4 first:pt-0 last:border-b-0 last:pb-0"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-inner bg-sage-tint text-sage-deep">
                  <FileText aria-hidden className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    to="/owner/statements/$statementId"
                    params={{ statementId: s.id }}
                    className="font-semibold text-ink hover:underline"
                  >
                    {monthLabel(s.month)}
                  </Link>
                  <p className="text-xs text-muted">
                    {many ? `${s.property.name} · ` : ''}Released {shortDate(s.releasedOn)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="figure font-semibold text-ink">{formatCents(s.netCents)}</p>
                  <p className="text-xs text-muted">Net to you</p>
                </div>
                <Button
                  variant="quiet"
                  size="sm"
                  loading={pdf.isPending && pdf.variables === s.id}
                  onClick={() => pdf.mutate(s.id)}
                  aria-label={`Download the ${monthLabel(s.month)} statement PDF${many ? ` for ${s.property.name}` : ''}`}
                >
                  <Download aria-hidden className="size-4" /> PDF
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

/** One released statement: the summary, stays, owner stays, expenses with receipts, and the payment. */
export function OwnerStatementPage({ statementId }: { statementId: string }) {
  const api = useApi();
  const query = useQuery(queries.ownerStatement(api, statementId));
  const pdf = usePdf(api);
  const [actionError, setActionError] = useState<unknown>(null);
  const s = query.data;

  const back = (
    <Link
      to="/owner/statements"
      className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
    >
      <ArrowLeft aria-hidden className="size-4" /> All statements
    </Link>
  );
  if (query.error) {
    return (
      <>
        {back}
        <LoadError what="this statement" onRetry={() => void query.refetch()} retrying={query.isFetching} />
      </>
    );
  }
  if (!s) {
    return (
      <div role="status" aria-label="Loading statement" className="flex flex-col gap-6">
        <Skeleton className="h-16 w-2/3 rounded-inner" />
        <Skeleton className="h-80 rounded-card" />
      </div>
    );
  }
  const adjustments = s.lines.filter((l) => l.kind === 'ADJUSTMENT');

  return (
    <>
      {back}
      <PageHeader
        eyebrow={s.property.name}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {monthLabel(s.month)}
            <Pill tone="sage">Released {shortDate(s.released.on)}</Pill>
          </span>
        }
        actions={
          <Button onClick={() => pdf.mutate(s.id)} loading={pdf.isPending}>
            <Download aria-hidden className="size-4" /> Download PDF
          </Button>
        }
      />
      <div className="flex flex-col gap-6">
        <ErrorAlert error={pdf.error ?? actionError} />
        <div className="grid items-start gap-6 @5xl/content:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="order-first flex flex-col gap-6 @5xl/content:sticky @5xl/content:top-6 @5xl/content:order-last">
            <Card title="Summary">
              <StatementSummary statement={{ ...s, status: 'RELEASED' }} netLabel="Net to you" />
            </Card>
            <Card title="Paid">
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Sent to you on</dt>
                  <dd className="font-medium text-ink">{shortDate(s.released.on)}</dd>
                </div>
                {s.released.paymentReference && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">Payment reference</dt>
                    <dd className="font-medium break-all text-ink">{s.released.paymentReference}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Amount</dt>
                  <dd className="figure font-semibold text-ink">{formatCents(s.totals.netCents)}</dd>
                </div>
              </dl>
            </Card>
          </div>
          <div className="flex min-w-0 flex-col gap-6">
            <StaysSection
              statement={s}
              description={`What each stay earned you: its payout less the guest cleaning fee, split per night into ${monthLabel(s.month)}.`}
            />
            <OwnerStaysSection statement={s} />
            <ExpensesSection statement={s} onViewReceipt={(id) => void openFile(api, id).catch(setActionError)} />
            {adjustments.length > 0 && (
              <Card title="Adjustments" description="Corrections TruHost made, each with its reason.">
                <ul className="flex flex-col">
                  {adjustments.map((a) => (
                    <li
                      key={a.adjustmentId}
                      className="flex items-start justify-between gap-4 border-b border-line py-3 first:pt-0 last:border-b-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-ink">{a.description}</p>
                        {a.detail && <p className="text-xs text-muted">{a.detail}</p>}
                      </div>
                      <span className="figure shrink-0 font-semibold text-ink">{formatSigned(a.amountCents)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/** Care: before-and-after photos from each turnover, once cleaning is in TruHost (Phase 3). */
export function OwnerCarePage() {
  return (
    <>
      <PageHeader title="Care" description="Before-and-after photos from every clean, room by room." />
      <Card>
        <EmptyState size="compact" illustration={<CareIllustration />} title="Nothing here yet">
          Clean photos will appear here after each turnover.
        </EmptyState>
      </Card>
    </>
  );
}
