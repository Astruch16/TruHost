import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../lib/api-context';
import { todayIso } from '../../lib/dates';
import { queries } from '../../lib/queries';
import { TimeOffIcon } from '../illustrations/list-icons';
import { LoadError } from '../ui/alert';
import { PageHeader } from '../ui/page-header';
import { Skeleton } from '../ui/skeleton';
import { RequestTimeOff } from './request-time-off';
import { TimeOffCard } from './time-off-card';

/**
 * A cleaner's time off: ask for days to be kept free, and see each request and what TruHost decided. Coming up and
 * waiting first; past, declined and cancelled ones below.
 */
export function CleanerTimeOffPage() {
  const api = useApi();
  const list = useQuery(queries.timeOff(api));
  const today = todayIso();
  const items = list.data?.items ?? [];
  const open = items.filter((r) => (r.status === 'PENDING' || r.status === 'APPROVED') && r.endDate >= today);
  const closed = items.filter((r) => !open.includes(r)).reverse();
  return (
    <>
      <PageHeader
        title="Time off"
        description="Ask TruHost to keep days free: a holiday, time off, or other work. You’ll see here when it’s approved."
      />
      <div className="grid grid-cols-1 items-start gap-6 @4xl/content:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <RequestTimeOff />
        <section aria-labelledby="your-requests" className="flex flex-col gap-3">
          <h2 id="your-requests" className="text-lg font-bold text-ink">
            Your requests
          </h2>
          {list.error ? (
            <LoadError what="your time off" onRetry={() => void list.refetch()} retrying={list.isFetching} />
          ) : !list.data ? (
            <Skeleton className="h-32 rounded-card" />
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-line-soft px-6 py-10 text-center">
              <TimeOffIcon size={48} />
              <p className="font-bold text-ink">No time off asked for yet</p>
              <p className="max-w-xs text-sm text-muted">Your requests, and what TruHost decides, will show here.</p>
            </div>
          ) : (
            <>
              {open.length > 0 && (
                <ul aria-label="Coming up" className="flex flex-col gap-3">
                  {open.map((r) => (
                    <TimeOffCard key={r.id} request={r} />
                  ))}
                </ul>
              )}
              {closed.length > 0 && (
                <>
                  <h3 className="mt-2 text-sm font-semibold tracking-[0.06em] text-muted uppercase">Earlier</h3>
                  <ul aria-label="Earlier" className="flex flex-col gap-3">
                    {closed.map((r) => (
                      <TimeOffCard key={r.id} request={r} />
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
