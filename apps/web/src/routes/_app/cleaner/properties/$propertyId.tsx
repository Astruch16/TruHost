import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@truhost/api-client';
import { Sparkles } from 'lucide-react';
import { PropertyAddressCard, PropertyRoomsCard } from '../../../../components/property-basics';
import { NotAvailable } from '../../../../components/shell/not-available';
import { ErrorAlert } from '../../../../components/ui/alert';
import { Card } from '../../../../components/ui/card';
import { PageHeader } from '../../../../components/ui/page-header';
import { LoadingBlock } from '../../../../components/ui/skeleton';
import { propertyRole } from '../../../../lib/access';
import { useApi } from '../../../../lib/api-context';
import { queries } from '../../../../lib/queries';

/**
 * A cleaner's view of a property: name, address, stay times and rooms. No financial sections, ever. Cleans,
 * photos and supplies arrive in Phase 3.
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
      <div className="grid gap-6 @4xl/content:grid-cols-2">
        <PropertyAddressCard property={p} />
        <Card title="Your cleans">
          <p className="flex gap-2.5 text-sm text-muted">
            <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0" />
            Your cleaning schedule, photo checklist and supplies will appear here.
          </p>
        </Card>
        <PropertyRoomsCard propertyId={propertyId} className="@4xl/content:col-span-2" />
      </div>
    </>
  );
}
