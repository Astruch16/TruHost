import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { EmptyState } from '../../components/ui/empty-state';
import { LoadingBlock } from '../../components/ui/skeleton';
import { useApi } from '../../lib/api-context';
import { queries } from '../../lib/queries';
import { landingPath } from '../../lib/portal-entry';

export const Route = createFileRoute('/_app/')({
  component: Home,
});

function Home() {
  const me = useQuery(queries.me(useApi()));
  if (!me.data) return <LoadingBlock />;
  const to = landingPath(me.data);
  if (to !== '/') return <Navigate to={to} replace />;
  return (
    <EmptyState title="No properties yet">
      You don’t have access to any properties yet. A TruHost admin will add you.
    </EmptyState>
  );
}
