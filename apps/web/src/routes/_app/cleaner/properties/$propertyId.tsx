import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@truhost/api-client';
import { PropertyCleansCard } from '../../../../components/cleaner/property-cleans';
import { PropertyAddressCard, PropertyRoomsCard } from '../../../../components/property-basics';
import { DamageCard } from '../../../../components/damage/damage-card';
import { NotAvailable } from '../../../../components/shell/not-available';
import { SuppliesCard } from '../../../../components/supplies/supplies-card';
import { ErrorAlert } from '../../../../components/ui/alert';
import { PageHeader } from '../../../../components/ui/page-header';
import { LoadingBlock } from '../../../../components/ui/skeleton';
import { propertyRole } from '../../../../lib/access';
import { useApi } from '../../../../lib/api-context';
import { queries } from '../../../../lib/queries';

/**
 * A cleaner's view of a property: supplies (mark how full each one is), damage reports (report guest damage with
 * photos), their next cleans here, address, stay times and rooms. No financial sections, ever.
 */
export const Route = createFileRoute('/_app/cleaner/properties/$propertyId')({
  component: CleanerProperty,
});

function CleanerProperty() {
  const { propertyId } = Route.useParams();
  const api = useApi();
  const me = useQuery(queries.me(api));
  const cleans = me.data ? propertyRole(me.data, propertyId) === 'CLEANER' : false;
  const property = useQuery({ ...queries.property(api, propertyId), enabled: cleans });

  if (!me.data) return <LoadingBlock />;
  if (!cleans) return <NotAvailable />;
  if (property.error) {
    return property.error instanceof ApiError && property.error.status === 404 ? (
      <NotAvailable />
    ) : (
      <ErrorAlert error={property.error} />
    );
  }
  if (!property.data) return <LoadingBlock />;
  const p = property.data;

  return (
    <>
      <PageHeader eyebrow="You clean here" title={p.name} description={`${p.city}, ${p.province}`} />
      <div className="grid grid-cols-1 gap-6 @4xl/content:grid-cols-2">
        {/* Wrappers carry the welcome tour's anchors (data-tour) and the grid span. */}
        <div data-tour="cleaner-supplies" className="min-w-0 @4xl/content:col-span-2">
          <SuppliesCard propertyId={propertyId} mode="report" />
        </div>
        <div data-tour="cleaner-damage" className="min-w-0 @4xl/content:col-span-2">
          <DamageCard propertyId={propertyId} canReport />
        </div>
        <PropertyAddressCard property={p} />
        <PropertyCleansCard propertyId={propertyId} />
        <div data-tour="cleaner-rooms" className="min-w-0 @4xl/content:col-span-2">
          <PropertyRoomsCard propertyId={propertyId} />
        </div>
      </div>
    </>
  );
}
