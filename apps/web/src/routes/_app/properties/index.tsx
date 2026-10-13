import type { ReactNode } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { MyPropertyCard, MyPropertyCardSkeleton } from '../../../components/properties/my-property-card';
import { LoadError } from '../../../components/ui/alert';
import { EmptyState } from '../../../components/ui/empty-state';
import { PageHeader } from '../../../components/ui/page-header';
import { useApi } from '../../../lib/api-context';
import { myProperties, type MyProperty } from '../../../lib/my-properties';
import { queries } from '../../../lib/queries';

/**
 * Owner/cleaner landing: the properties this person holds a membership on (admins included), as photo cards. Someone
 * who owns some and cleans others sees them in two groups.
 */
export const Route = createFileRoute('/_app/properties/')({
  component: MyProperties,
});

const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))] gap-5';

function MyProperties() {
  const api = useApi();
  const me = useQuery(queries.me(api));
  const properties = useQuery({ ...queries.properties(api), enabled: me.isSuccess });
  const error = me.error ?? properties.error;
  const loading = !me.data || !properties.data;
  const { owned, cleaned } = loading ? { owned: [], cleaned: [] } : myProperties(me.data, properties.data.items);
  const total = owned.length + cleaned.length;

  return (
    <>
      <PageHeader
        title="My properties"
        description={loading || total === 0 ? undefined : describe(owned.length, cleaned.length)}
      />
      {error ? (
        <LoadError
          what="your properties"
          onRetry={() => void Promise.all([me.refetch(), properties.refetch()])}
          retrying={me.isFetching || properties.isFetching}
        />
      ) : loading ? (
        <div className={GRID} role="status" aria-label="Loading your properties">
          {[0, 1, 2].map((i) => (
            <MyPropertyCardSkeleton key={i} />
          ))}
        </div>
      ) : total === 0 ? (
        <EmptyState title="No properties yet">A TruHost admin will add you to a property.</EmptyState>
      ) : owned.length > 0 && cleaned.length > 0 ? (
        <div className="flex flex-col gap-10">
          <Group title="Properties you own" items={owned} />
          <Group title="Properties you clean" items={cleaned} />
        </div>
      ) : (
        <Cards items={owned.length ? owned : cleaned} />
      )}
    </>
  );
}

function describe(owned: number, cleaned: number): string {
  const n = (count: number) => `${count} propert${count === 1 ? 'y' : 'ies'}`;
  if (owned && cleaned) return `You own ${n(owned)} and clean ${n(cleaned)}.`;
  return owned ? `You own ${n(owned)} with TruHost.` : `You clean ${n(cleaned)} for TruHost.`;
}

function Group({ title, items }: { title: string; items: MyProperty[] }): ReactNode {
  return (
    <section aria-label={title} className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold tracking-[0.08em] text-muted uppercase">{title}</h2>
      <Cards items={items} />
    </section>
  );
}

function Cards({ items }: { items: MyProperty[] }) {
  return (
    <ul className={GRID}>
      {items.map((item) => (
        <li key={item.property.id}>
          <MyPropertyCard item={item} />
        </li>
      ))}
    </ul>
  );
}
