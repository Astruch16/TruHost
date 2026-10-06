import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Card, ErrorBanner, Loading, PageHeader } from '../../../components/ui';
import { useApi } from '../../../lib/api-context';
import { queries } from '../../../lib/queries';
import { formatBps } from '../../../lib/format';

/**
 * Read-only property view for owners and cleaners. The API decides which fields come back
 * (e.g. access instructions only for cleaners); this page just renders what it gets.
 */
export const Route = createFileRoute('/_app/properties/$propertyId')({
  component: PropertyView,
});

function PropertyView() {
  const { propertyId } = Route.useParams();
  const api = useApi();
  const me = useQuery(queries.me(api));
  const property = useQuery(queries.property(api, propertyId));
  const rooms = useQuery(queries.rooms(api, propertyId));
  const isOwner = me.data?.memberships.some((m) => m.property.id === propertyId && m.role === 'OWNER') ?? false;
  const plan = useQuery({ ...queries.propertyPlan(api, propertyId), enabled: isOwner });

  if (property.error) return <ErrorBanner error={property.error} />;
  if (!property.data) return <Loading />;
  const p = property.data;

  return (
    <>
      <PageHeader title={p.name} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Address">
          <p className="text-sm">
            {p.addressLine1}
            {p.addressLine2 && <>, {p.addressLine2}</>}
            <br />
            {p.city}, {p.province} {p.postalCode}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Check-in {p.checkInTime} · Check-out {p.checkOutTime}
          </p>
        </Card>
        {p.accessInstructions !== undefined && (
          <Card title="Access">
            <p className="whitespace-pre-wrap text-sm">{p.accessInstructions || 'No access instructions yet.'}</p>
          </Card>
        )}
        {isOwner && (
          <Card title="Management plan">
            {plan.data?.current ? (
              <p className="text-sm">
                {plan.data.current.plan.name}: {formatBps(plan.data.current.plan.managementFeeBps)} of monthly gross
                revenue, since {plan.data.current.effectiveFrom}
              </p>
            ) : (
              <p className="text-sm text-slate-600">No plan assigned.</p>
            )}
          </Card>
        )}
        <Card title="Rooms">
          {rooms.data ? (
            <ol className="list-decimal pl-5 text-sm">
              {rooms.data.items.map((r) => (
                <li key={r.id}>{r.name}</li>
              ))}
            </ol>
          ) : (
            <Loading />
          )}
        </Card>
      </div>
    </>
  );
}
