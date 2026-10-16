import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { OwnerHomePage } from '../../../components/owner-portal/owner-home';
import { useApi } from '../../../lib/api-context';
import { queries } from '../../../lib/queries';
import { monthSearch, useScope } from '../../../lib/scope';

/** The owner's home page. */
export const Route = createFileRoute('/_app/owner/')({
  validateSearch: monthSearch,
  component: OwnerHome,
});

function OwnerHome() {
  const api = useApi();
  const me = useQuery(queries.me(api));
  const properties = useQuery(queries.ownerProperties(api));
  const { propertyId } = useScope();
  const name = properties.data?.items.find((p) => p.id === propertyId)?.name ?? null;
  const navigate = Route.useNavigate();
  const { month } = Route.useSearch();
  return (
    <OwnerHomePage
      firstName={me.data?.firstName ?? ''}
      propertyId={propertyId}
      propertyName={name}
      month={month ?? null}
      onMonthChange={(m) => void navigate({ search: { month: m }, replace: true })}
    />
  );
}
