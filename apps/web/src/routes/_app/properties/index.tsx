import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, DoorClosed } from 'lucide-react';
import { ErrorAlert } from '../../../components/ui/alert';
import { EmptyState } from '../../../components/ui/empty-state';
import { PageHeader } from '../../../components/ui/page-header';
import { Pill } from '../../../components/ui/pill';
import { LoadingBlock } from '../../../components/ui/skeleton';
import { useApi } from '../../../lib/api-context';
import { queries } from '../../../lib/queries';

/** Owner/cleaner landing: the properties this user holds a membership on (admins included). */
export const Route = createFileRoute('/_app/properties/')({
  component: MyProperties,
});

function MyProperties() {
  const me = useQuery(queries.me(useApi()));
  return (
    <>
      <PageHeader title="My properties" />
      {me.error ? (
        <ErrorAlert error={me.error} />
      ) : !me.data ? (
        <LoadingBlock />
      ) : me.data.memberships.length === 0 ? (
        <EmptyState icon={DoorClosed} title="No properties yet">
          A TruHost admin will add you to a property.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-4">
          {me.data.memberships.map((m) => (
            <li key={m.id}>
              <Link
                to="/properties/$propertyId"
                params={{ propertyId: m.property.id }}
                className="group flex min-h-24 items-center gap-4 rounded-card border border-line-soft bg-surface p-5 transition-[border-color,box-shadow] hover:border-line hover:shadow-sm"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-semibold text-ink">{m.property.name}</span>
                  <span className="mt-1.5 block">
                    <Pill tone={m.role === 'OWNER' ? 'sage' : 'blue'}>{m.role === 'OWNER' ? 'Owner' : 'Cleaner'}</Pill>
                  </span>
                </span>
                <ChevronRight aria-hidden className="size-5 text-muted transition-colors group-hover:text-ink" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
