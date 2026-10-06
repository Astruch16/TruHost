import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Loading } from '../../components/ui';
import { useApi } from '../../lib/api-context';
import { queries } from '../../lib/queries';

export const Route = createFileRoute('/_app/')({
  component: Home,
});

function Home() {
  const me = useQuery(queries.me(useApi()));
  if (!me.data) return <Loading />;
  if (me.data.staffRole === 'ADMIN') return <Navigate to="/admin/properties" />;
  if (me.data.memberships.length > 0) return <Navigate to="/properties" />;
  return <p className="text-sm text-slate-600">You don’t have access to any properties yet.</p>;
}
