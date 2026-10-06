import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Badge, Loading, PageHeader } from '../../../components/ui';
import { useApi } from '../../../lib/api-context';
import { queries } from '../../../lib/queries';

/** Owner/cleaner landing: the properties this user holds a membership on (admins included). */
export const Route = createFileRoute('/_app/properties/')({
  component: MyProperties,
});

function MyProperties() {
  const me = useQuery(queries.me(useApi()));
  if (!me.data) return <Loading />;
  return (
    <>
      <PageHeader title="My properties" />
      {me.data.memberships.length === 0 ? (
        <p className="text-sm text-slate-600">You don’t have access to any properties yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {me.data.memberships.map((m) => (
            <li key={m.id}>
              <Link
                to="/properties/$propertyId"
                params={{ propertyId: m.property.id }}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-400"
              >
                <span className="font-medium">{m.property.name}</span>
                <Badge>{m.role === 'OWNER' ? 'Owner' : 'Cleaner'}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
