import { createFileRoute, Outlet } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Loading } from '../../components/ui';
import { useApi } from '../../lib/api-context';
import { queries } from '../../lib/queries';

/** Hides admin screens from non-admins. Convenience only: the API enforces access on every call. */
export const Route = createFileRoute('/_app/admin')({
  component: AdminLayout,
});

function AdminLayout() {
  const me = useQuery(queries.me(useApi()));
  if (!me.data) return <Loading />;
  if (me.data.staffRole !== 'ADMIN') return <p className="text-sm text-slate-600">Page not found.</p>;
  return <Outlet />;
}
