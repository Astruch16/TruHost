import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { TimeOffQuery } from '@truhost/shared';
import { useApi } from '../../lib/api-context';
import { cx } from '../../lib/cx';
import { todayIso } from '../../lib/dates';
import { queries } from '../../lib/queries';
import { TimeOffIcon } from '../illustrations/list-icons';
import { LoadError } from '../ui/alert';
import { PageHeader } from '../ui/page-header';
import { Skeleton } from '../ui/skeleton';
import { TimeOffCard } from './time-off-card';

type View = 'waiting' | 'approved' | 'all';

/**
 * Admins: cleaners' time off. Requests waiting for a decision first (with the cleans each would leave uncovered), then
 * approved time off still to come, or everything.
 */
export function AdminTimeOffPage() {
  const api = useApi();
  const [view, setView] = useState<View>('waiting');
  const today = todayIso();
  const query: TimeOffQuery =
    view === 'waiting' ? { status: 'PENDING' } : view === 'approved' ? { status: 'APPROVED', from: today } : {};
  const list = useQuery(queries.timeOff(api, query));
  const waiting = useQuery(queries.timeOff(api, { status: 'PENDING' }));
  const items = view === 'all' ? [...(list.data?.items ?? [])].reverse() : (list.data?.items ?? []);
  const views: { value: View; label: string }[] = [
    { value: 'waiting', label: `Waiting${waiting.data ? ` (${waiting.data.items.length})` : ''}` },
    { value: 'approved', label: 'Approved, coming up' },
    { value: 'all', label: 'All' },
  ];
  return (
    <>
      <PageHeader
        title="Time off"
        description="Days cleaners have asked to keep free. Approve or decline them, and reassign any cleans they’d miss."
      />
      <div role="group" aria-label="Show" className="mb-5 flex flex-wrap gap-2">
        {views.map((v) => (
          <button
            key={v.value}
            type="button"
            aria-pressed={view === v.value}
            onClick={() => setView(v.value)}
            className={cx(
              'inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm font-medium transition-colors',
              view === v.value
                ? 'border-primary bg-primary text-primary-ink'
                : 'border-line bg-surface text-ink hover:bg-ground',
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
      {list.error ? (
        <LoadError what="time off" onRetry={() => void list.refetch()} retrying={list.isFetching} />
      ) : !list.data ? (
        <div role="status" aria-label="Loading time off" className="grid grid-cols-1 gap-3 @3xl/content:grid-cols-2">
          <Skeleton className="h-40 rounded-card" />
          <Skeleton className="h-40 rounded-card" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-line-soft px-6 py-12 text-center">
          <TimeOffIcon size={56} />
          <p className="font-bold text-ink">
            {view === 'waiting' ? 'Nothing waiting' : view === 'approved' ? 'No time off coming up' : 'No requests yet'}
          </p>
          <p className="max-w-sm text-sm text-muted">
            When a cleaner asks for days off, you’ll be told and can decide here.
          </p>
        </div>
      ) : (
        <ul aria-label="Requests" className="grid grid-cols-1 items-start gap-3 @3xl/content:grid-cols-2">
          {items.map((r) => (
            <TimeOffCard key={r.id} request={r} showCleaner />
          ))}
        </ul>
      )}
    </>
  );
}
