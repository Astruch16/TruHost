import { createFileRoute, Outlet } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { SearchX } from 'lucide-react';
import { EmptyState } from '../../components/ui/empty-state';
import { LoadingBlock } from '../../components/ui/skeleton';
import { useApi } from '../../lib/api-context';
import { queries } from '../../lib/queries';

/** Hides admin screens from non-admins. Convenience only: the API enforces access on every call. */
export const Route = createFileRoute('/_app/admin')({
  component: AdminLayout,
});

function AdminLayout() {
  const me = useQuery(queries.me(useApi()));
  if (!me.data) return <LoadingBlock />;
  if (me.data.staffRole !== 'ADMIN') return <EmptyState icon={SearchX} title="Page not found" />;
  return <Outlet />;
}
