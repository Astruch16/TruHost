import { createFileRoute, Outlet } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { NotAvailable } from '../../components/shell/not-available';
import { LoadingBlock } from '../../components/ui/skeleton';
import { useApi } from '../../lib/api-context';
import { queries } from '../../lib/queries';

/**
 * The cleaner's screens. Only for people who clean at least one property. Convenience only: the API enforces
 * access on every call.
 */
export const Route = createFileRoute('/_app/cleaner')({
  component: CleanerLayout,
});

function CleanerLayout() {
  const me = useQuery(queries.me(useApi()));
  if (!me.data) return <LoadingBlock />;
  if (!me.data.memberships.some((m) => m.role === 'CLEANER')) return <NotAvailable />;
  return <Outlet />;
}
