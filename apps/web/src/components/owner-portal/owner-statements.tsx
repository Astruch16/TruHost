import { useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { unwrap, type ApiClient } from '@truhost/api-client';
import type { OwnerStatementSummary } from '@truhost/shared';
import {
  ArrowDownWideNarrow,
  ArrowLeft,
  ArrowUpNarrowWide,
  CalendarArrowDown,
  CalendarArrowUp,
  Download,
} from 'lucide-react';
import { StatementDocIcon } from '../illustrations/list-icons';
import { useApi } from '../../lib/api-context';
import { cx } from '../../lib/cx';
import { formatCents, splitCents } from '../../lib/money';
import { monthLabel, shortDate } from '../../lib/months';
import { monthOnly } from '../../lib/owner';
import { queries } from '../../lib/queries';
import {
  filterStatements,
  groupByYear,
  sortStatements,
  statementPeriods,
  STATEMENT_SORTS,
  type StatementSort,
} from '../../lib/statement-list';
import { switchingStyles } from '../../lib/styles';
import { formatSigned } from '../../lib/statements';
import { openFile } from '../../lib/upload';
import { CareIllustration } from '../illustrations/care';
import { ReceiptsIllustration } from '../illustrations/receipts';
import { StatementSummary } from '../statements/statement-summary';
import { ExpensesSection, OwnerStaysSection, StaysSection } from '../statements/statement-sections';
import { ErrorAlert, LoadError } from '../ui/alert';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { EmptyState } from '../ui/empty-state';
import { PageHeader } from '../ui/page-header';
import { Pill } from '../ui/pill';
import { Select } from '../ui/select';
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

/**
 * Released statements for the properties the owner sees in the switcher, as cards in a grid. They can be sorted
 * (newest, oldest, highest or lowest net to you) and narrowed to a year or a month of the year; sorted by month,
 * they're grouped by year.
 */
export function OwnerStatementsPage({ propertyId }: { propertyId: string | null }) {
  const api = useApi();
  const list = useQuery(queries.ownerStatements(api, propertyId));
  const pdf = usePdf(api);
  const [sort, setSort] = useState<StatementSort>('newest');
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const items = list.data?.items ?? [];
  const many = new Set(items.map((s) => s.property.id)).size > 1;
  const periods = statementPeriods(items);
  // A year or month that's no longer in the list (another property chosen) stops narrowing it.
  const y = periods.years.includes(year) ? year : '';
  const m = periods.months.includes(month) ? month : '';
  const shown = sortStatements(filterStatements(items, y, m), sort);
  const byMonth = sort === 'newest' || sort === 'oldest';
  const groups = byMonth && periods.years.length > 1 && !y ? groupByYear(shown) : [{ year: '', items: shown }];
  const clear = () => {
    setYear('');
    setMonth('');
  };

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
        <div role="status" aria-label="Loading statements" className={GRID}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-52 rounded-card" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className={switchingStyles(list.isPlaceholderData)} tour="owner-statements">
          <EmptyState title="No statements yet">
            Your first statement arrives after the month ends, once TruHost has checked every payout and receipt. You’ll
            get an email when it’s ready.
          </EmptyState>
        </Card>
      ) : (
        <div
          className={cx('flex flex-col gap-6', switchingStyles(list.isPlaceholderData))}
          data-tour="owner-statements"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              role="group"
              aria-label="Sort statements"
              className="grid w-full grid-cols-4 gap-1.5 sm:flex sm:w-auto sm:flex-wrap sm:gap-2"
            >
              {STATEMENT_SORTS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  aria-pressed={sort === o.key}
                  onClick={() => setSort(o.key)}
                  className={cx(
                    'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border px-2 text-sm font-medium transition-colors sm:px-3.5',
                    sort === o.key
                      ? 'border-primary bg-primary text-primary-ink'
                      : 'border-line bg-surface text-ink hover:bg-ground',
                  )}
                >
                  {SORT_ICONS[o.key]}
                  {o.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {periods.years.length > 1 && (
                <Select
                  aria-label="Year"
                  value={y}
                  onValueChange={setYear}
                  options={[{ value: '', label: 'All years' }, ...periods.years.map((v) => ({ value: v, label: v }))]}
                  className="w-36"
                />
              )}
              {periods.months.length > 1 && (
                <Select
                  aria-label="Month"
                  value={m}
                  onValueChange={setMonth}
                  options={[
                    { value: '', label: 'All months' },
                    ...periods.months.map((v) => ({ value: v, label: monthOnly(`2000-${v}`) })),
                  ]}
                  className="w-40"
                />
              )}
            </div>
          </div>

          {shown.length === 0 ? (
            <Card>
              <EmptyState
                size="compact"
                illustration={<ReceiptsIllustration />}
                title="No statements match"
                action={
                  <Button variant="secondary" onClick={clear}>
                    Show all statements
                  </Button>
                }
              >
                There’s no statement for {[m && monthOnly(`2000-${m}`), y].filter(Boolean).join(' ')}.
              </EmptyState>
            </Card>
          ) : (
            groups.map((g) => (
              <section key={g.year || 'all'} aria-label={g.year || undefined}>
                {g.year && (
                  <h2 className="mb-3 flex items-baseline gap-2 text-sm font-semibold tracking-[0.08em] text-muted uppercase">
                    {g.year}
                    <span className="font-medium tracking-normal normal-case">
                      · {g.items.length} {g.items.length === 1 ? 'statement' : 'statements'}
                    </span>
                  </h2>
                )}
                <ul className={GRID}>
                  {g.items.map((s) => (
                    <StatementCard
                      key={s.id}
                      statement={s}
                      showProperty={many}
                      pdfLoading={pdf.isPending && pdf.variables === s.id}
                      onPdf={() => pdf.mutate(s.id)}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      )}
    </>
  );
}

const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(min(100%,17.5rem),1fr))] gap-4';

const SORT_ICONS: Record<StatementSort, ReactNode> = {
  newest: <CalendarArrowDown aria-hidden className="size-4 max-sm:hidden" />,
  oldest: <CalendarArrowUp aria-hidden className="size-4 max-sm:hidden" />,
  highest: <ArrowDownWideNarrow aria-hidden className="size-4 max-sm:hidden" />,
  lowest: <ArrowUpNarrowWide aria-hidden className="size-4 max-sm:hidden" />,
};

/** One statement as a card: its month (opens it), when it was released, net to you, and its PDF. */
function StatementCard({
  statement: s,
  showProperty,
  pdfLoading,
  onPdf,
}: {
  statement: OwnerStatementSummary;
  showProperty: boolean;
  pdfLoading: boolean;
  onPdf: () => void;
}) {
  const { whole, cents } = splitCents(s.netCents);
  return (
    <li className="group relative flex flex-col rounded-card border border-line-soft bg-surface p-5 transition-[border-color,box-shadow] hover:border-line hover:shadow-[0_6px_18px_rgb(16_20_18/0.06)]">
      <div className="flex items-start justify-between gap-3">
        <StatementDocIcon size={44} className="shrink-0" />
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-tint px-2.5 py-1 text-xs font-semibold text-sage-deep">
          <span aria-hidden className="size-1.5 rounded-full bg-sage-deep" />
          Released {shortDate(s.releasedOn)}
        </span>
      </div>
      <h3 className="mt-4 text-lg leading-snug font-bold text-ink">
        {/* The link covers the card, so anywhere on it opens the statement; the PDF button sits above it. */}
        <Link
          to="/owner/statements/$statementId"
          params={{ statementId: s.id }}
          className="rounded-card after:absolute after:inset-0 after:rounded-card focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-blue-deep"
        >
          {monthLabel(s.month)}
        </Link>
      </h3>
      {showProperty && <p className="truncate text-sm text-muted">{s.property.name}</p>}
      {/* Cards in a row line up their footers, however long the property name above. */}
      <div aria-hidden className="min-h-4 flex-1" />
      <div className="flex items-end justify-between gap-3 border-t border-line-soft pt-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">Net to you</p>
          <p className="figure mt-1 text-2xl leading-none font-bold text-ink">
            {whole}
            <span className="text-[0.65em] text-muted">{cents}</span>
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          loading={pdfLoading}
          onClick={onPdf}
          className="relative z-10"
          aria-label={`Download the ${monthLabel(s.month)} statement PDF${showProperty ? ` for ${s.property.name}` : ''}`}
        >
          <Download aria-hidden className="size-4" /> PDF
        </Button>
      </div>
    </li>
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
      <Card tour="owner-care">
        <EmptyState size="compact" illustration={<CareIllustration />} title="Nothing here yet">
          Clean photos will appear here after each turnover.
        </EmptyState>
      </Card>
    </>
  );
}
