import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TriangleAlert } from 'lucide-react';
import { useApi } from '../../lib/api-context';
import { cx } from '../../lib/cx';
import { claimWindow } from '../../lib/damage';
import { todayIso } from '../../lib/dates';
import { shortDate } from '../../lib/months';
import { queries } from '../../lib/queries';
import { KpiCard } from '../dashboard/kpi-card';
import { DamageIllustration } from '../illustrations/damage';
import { LoadError } from '../ui/alert';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { EmptyState } from '../ui/empty-state';
import { PageHeader } from '../ui/page-header';
import { Skeleton } from '../ui/skeleton';
import { DamageList } from './damage-list';
import { DamageReportDialog } from './damage-report-dialog';
import { ReportDamageDialog } from './report-damage-dialog';

const FILTERS = [
  { key: 'OPEN', label: 'Open' },
  { key: 'TO_CLAIM', label: 'Claims to file' },
  { key: 'CLAIM_FILED', label: 'Claim filed' },
  { key: 'RESOLVED', label: 'Resolved' },
  { key: 'ALL', label: 'All' },
] as const;
type Filter = (typeof FILTERS)[number]['key'];

/**
 * Damage reports across the properties (or `propertyId`, the one chosen in the switcher): summary tiles, filters,
 * the list, and reporting. The admin Damage page.
 */
export function DamagePage({ propertyId }: { propertyId: string | null }) {
  const api = useApi();
  const reports = useQuery(queries.damageReports(api, 'ALL', propertyId ?? undefined));
  const properties = useQuery(queries.properties(api));
  const [filter, setFilter] = useState<Filter>('OPEN');
  const [reporting, setReporting] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const today = todayIso();
  const items = reports.data?.items ?? [];
  const toClaim = (r: (typeof items)[number]) => {
    const w = claimWindow(r, today);
    return r.status !== 'DRAFT' && w !== null && !w.closed;
  };
  const match: Record<Filter, (r: (typeof items)[number]) => boolean> = {
    OPEN: (r) => r.status !== 'RESOLVED',
    TO_CLAIM: toClaim,
    CLAIM_FILED: (r) => r.status === 'CLAIM_FILED',
    RESOLVED: (r) => r.status === 'RESOLVED',
    ALL: () => true,
  };
  const count = (f: Filter) => items.filter(match[f]).length;
  const shown = items.filter(match[filter]);
  const nextDeadline = items
    .filter(toClaim)
    .map((r) => r.claimDeadline!)
    .sort()[0];
  const list = properties.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Damage reports"
        description="Guest damage reported by cleaners and TruHost, with photos, for claims with the booking sites."
        actions={
          <Button onClick={() => setReporting(true)} disabled={list.length === 0}>
            <TriangleAlert aria-hidden className="size-4" /> Report damage
          </Button>
        }
      />
      {reports.error ? (
        <LoadError what="damage reports" onRetry={() => void reports.refetch()} retrying={reports.isFetching} />
      ) : !reports.data ? (
        <div role="status" aria-label="Loading damage reports" className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 @2xl/content:grid-cols-4 @2xl/content:gap-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-card" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 @2xl/content:grid-cols-4 @2xl/content:gap-4">
            <KpiCard
              label="Open"
              value={count('OPEN')}
              support={
                items.some((r) => r.status === 'DRAFT')
                  ? `${items.filter((r) => r.status === 'DRAFT').length} still drafts`
                  : 'Not resolved yet'
              }
            />
            <KpiCard
              label="Claims to file"
              value={count('TO_CLAIM')}
              support={
                nextDeadline ? (
                  <>
                    Next due <strong className="text-ink">{shortDate(nextDeadline)}</strong>
                  </>
                ) : (
                  'None due'
                )
              }
            />
            <KpiCard label="Claim filed" value={count('CLAIM_FILED')} support="Waiting on the outcome" />
            <KpiCard label="Resolved" value={count('RESOLVED')} support="Closed reports" />
          </div>
          <Card>
            <div className="flex flex-col gap-4">
              <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    aria-pressed={filter === f.key}
                    onClick={() => setFilter(f.key)}
                    className={cx(
                      'inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors',
                      filter === f.key
                        ? 'border-primary bg-primary text-primary-ink'
                        : 'border-line bg-surface text-ink hover:bg-ground',
                    )}
                  >
                    {f.label}
                    <span
                      className={cx(
                        'figure rounded-full px-1.5 text-xs font-semibold',
                        filter === f.key ? 'bg-white/20 text-primary-ink' : 'bg-ground text-muted',
                      )}
                    >
                      {count(f.key)}
                    </span>
                  </button>
                ))}
              </div>
              {shown.length === 0 ? (
                <EmptyState size="compact" illustration={<DamageIllustration />} title="Nothing here">
                  {items.length === 0
                    ? 'No damage has been reported. Cleaners can report it from their property page.'
                    : 'No reports match this filter.'}
                </EmptyState>
              ) : (
                <DamageList items={shown} today={today} showProperty={!propertyId} onOpen={setOpen} />
              )}
            </div>
          </Card>
        </div>
      )}
      {reporting && (
        <ReportDamageDialog
          open
          onOpenChange={(o) => !o && setReporting(false)}
          properties={list}
          initialPropertyId={propertyId ?? undefined}
        />
      )}
      {open && <DamageReportDialog reportId={open} open onOpenChange={(o) => !o && setOpen(null)} />}
    </>
  );
}
