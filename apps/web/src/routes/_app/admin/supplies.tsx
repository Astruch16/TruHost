import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { AllClearIllustration } from '../../../components/illustrations/all-clear';
import { RestockList } from '../../../components/supplies/restock-list';
import { LoadError } from '../../../components/ui/alert';
import { EmptyState } from '../../../components/ui/empty-state';
import { PageHeader } from '../../../components/ui/page-header';
import { Skeleton } from '../../../components/ui/skeleton';
import { useApi } from '../../../lib/api-context';
import { queries } from '../../../lib/queries';
import { useScope } from '../../../lib/scope';

/**
 * Restock: every supply at or below its restock point, across the properties (or the one chosen in the switcher).
 * Each property's own page has its full supplies list.
 */
export const Route = createFileRoute('/_app/admin/supplies')({
  component: Restock,
});

function Restock() {
  const restock = useQuery(queries.restock(useApi()));
  const { propertyId } = useScope();
  const items = (restock.data?.items ?? []).filter((i) => !propertyId || i.property.id === propertyId);

  return (
    <>
      <PageHeader
        title="Restock"
        description="Supplies at or below their restock point. Mark one restocked once it’s topped up."
      />
      {restock.error ? (
        <LoadError what="the restock list" onRetry={() => void restock.refetch()} retrying={restock.isFetching} />
      ) : !restock.data ? (
        <div
          role="status"
          aria-label="Loading the restock list"
          className="grid grid-cols-1 gap-6 @4xl/content:grid-cols-2"
        >
          <Skeleton className="h-64 rounded-card" />
          <Skeleton className="h-64 rounded-card" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState size="compact" illustration={<AllClearIllustration />} title="Nothing to restock">
          Every supply {propertyId ? 'at this property' : 'at your properties'} is above its restock point.
        </EmptyState>
      ) : (
        <RestockList items={items} />
      )}
    </>
  );
}
