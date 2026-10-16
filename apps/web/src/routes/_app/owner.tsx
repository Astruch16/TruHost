import { createFileRoute, Outlet } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { NotAvailable } from '../../components/shell/not-available';
import { LoadingBlock } from '../../components/ui/skeleton';
import { useApi } from '../../lib/api-context';
import { queries } from '../../lib/queries';

/**
 * The owner portal (/owner/...): for anyone who owns a property, in the same shell as the rest of TruHost. Convenience
 * only: the owner API scopes every read to the caller's owned properties.
 */
export const Route = createFileRoute('/_app/owner')({
  component: OwnerLayout,
});

function OwnerLayout() {
  const me = useQuery(queries.me(useApi()));
  if (!me.data) return <LoadingBlock />;
  if (!me.data.memberships.some((m) => m.role === 'OWNER')) return <NotAvailable />;
  return <Outlet />;
}
