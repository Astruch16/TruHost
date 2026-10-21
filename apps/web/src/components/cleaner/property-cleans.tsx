import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../lib/api-context';
import { addDays, todayIso } from '../../lib/dates';
import { queries } from '../../lib/queries';
import { LoadError } from '../ui/alert';
import { Card } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { CleanRow } from './clean-row';

/** On a cleaner's property page: their next cleans here (today and the next month), each opening its walkthrough. */
export function PropertyCleansCard({ propertyId }: { propertyId: string }) {
  const api = useApi();
  const today = todayIso();
  const list = useQuery(
    queries.cleans(api, { propertyId, assignee: 'me', from: today, to: addDays(today, 30), status: 'SCHEDULED' }),
  );
  const items = list.data?.items ?? [];
  return (
    <Card
      title="Your cleans here"
      tour="cleaner-cleans"
      actions={
        <Link to="/cleaner" className="text-sm font-semibold text-primary hover:underline">
          Your schedule
        </Link>
      }
    >
      {list.error ? (
        <LoadError what="your cleans" onRetry={() => void list.refetch()} retrying={list.isFetching} />
      ) : !list.data ? (
        <Skeleton className="h-24 rounded-inner" />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">Nothing scheduled for you here in the next month.</p>
      ) : (
        <ul className="-mx-2 divide-y divide-line-soft">
          {items.slice(0, 4).map((c) => (
            <CleanRow key={c.id} clean={c} />
          ))}
        </ul>
      )}
    </Card>
  );
}
