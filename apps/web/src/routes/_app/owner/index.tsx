import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { OwnerHomePage } from '../../../components/owner-portal/owner-home';
import { useApi } from '../../../lib/api-context';
import { queries } from '../../../lib/queries';
import { useScope } from '../../../lib/scope';

/** The owner's home page. */
export const Route = createFileRoute('/_app/owner/')({
  component: OwnerHome,
});

function OwnerHome() {
  const api = useApi();
  const me = useQuery(queries.me(api));
  const properties = useQuery(queries.ownerProperties(api));
  const { propertyId } = useScope();
  const name = properties.data?.items.find((p) => p.id === propertyId)?.name ?? null;
  return <OwnerHomePage firstName={me.data?.firstName ?? ''} propertyId={propertyId} propertyName={name} />;
}
