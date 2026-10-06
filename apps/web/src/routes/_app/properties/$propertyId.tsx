import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Clock, MapPin } from 'lucide-react';
import { ErrorAlert } from '../../../components/ui/alert';
import { Card } from '../../../components/ui/card';
import { PageHeader } from '../../../components/ui/page-header';
import { Pill } from '../../../components/ui/pill';
import { LoadingBlock, Skeleton } from '../../../components/ui/skeleton';
import { useApi } from '../../../lib/api-context';
import { formatBps } from '../../../lib/format';
import { queries } from '../../../lib/queries';

/**
 * Read-only property view for owners and cleaners. The API decides which fields come back; this page renders what it
 * gets. The owner dashboard from the mockup replaces this view once Phase 2 data exists.
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

  if (property.error) return <ErrorAlert error={property.error} />;
  if (!property.data) return <LoadingBlock />;
  const p = property.data;

  return (
    <>
      <PageHeader eyebrow="Property details" title={p.name} description={`${p.city}, ${p.province}`} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Address">
          <div className="flex flex-col gap-3 text-sm">
            <p className="flex gap-2.5">
              <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
              <span>
                {p.addressLine1}
                {p.addressLine2 && <>, {p.addressLine2}</>}
                <br />
                {p.city}, {p.province} {p.postalCode}
              </span>
            </p>
            <p className="flex gap-2.5">
              <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
              <span className="figure">
                Check-in {p.checkInTime} · Check-out {p.checkOutTime}
              </span>
            </p>
          </div>
        </Card>
        {isOwner && (
          <Card title="Plan">
            {plan.error ? (
              <ErrorAlert error={plan.error} />
            ) : plan.isPending ? (
              <Skeleton className="h-6 w-2/3" />
            ) : plan.data?.current ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Pill tone="lavender">{plan.data.current.plan.name}</Pill>
                <span>
                  <span className="figure font-semibold">{formatBps(plan.data.current.plan.managementFeeBps)}</span> of
                  monthly gross revenue, since <span className="figure">{plan.data.current.effectiveFrom}</span>
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted">No plan assigned yet.</p>
            )}
          </Card>
        )}
        <Card title="Rooms" description="In cleaning-checklist order.">
          {rooms.error ? (
            <ErrorAlert error={rooms.error} />
          ) : !rooms.data ? (
            <Skeleton className="h-16" />
          ) : (
            <ol className="flex flex-col divide-y divide-line-soft text-sm">
              {rooms.data.items.map((r, i) => (
                <li key={r.id} className="flex items-center gap-3 py-2.5">
                  <span className="figure grid size-6 place-items-center rounded-full bg-ground text-xs font-semibold text-muted">
                    {i + 1}
                  </span>
                  {r.name}
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </>
  );
}
