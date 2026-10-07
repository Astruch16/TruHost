import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { DoorClosed } from 'lucide-react';
import { EmptyState } from '../../components/ui/empty-state';
import { LoadingBlock } from '../../components/ui/skeleton';
import { useApi } from '../../lib/api-context';
import { queries } from '../../lib/queries';

export const Route = createFileRoute('/_app/')({
  component: Home,
});

function Home() {
  const me = useQuery(queries.me(useApi()));
  if (!me.data) return <LoadingBlock />;
  if (me.data.staffRole === 'ADMIN') return <Navigate to="/admin" />;
  if (me.data.memberships.length > 0) return <Navigate to="/properties" />;
  return (
    <EmptyState icon={DoorClosed} title="No properties yet">
      You don’t have access to any properties yet. A TruHost admin will add you.
    </EmptyState>
  );
}
