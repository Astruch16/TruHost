import { createFileRoute, notFound } from '@tanstack/react-router';
import { PortalLoading } from '../../components/shell/portal-loading';

/** Dev-only preview of the portal loading screen (it moves to "slow" after 4s and "try again" after 12s). */
export const Route = createFileRoute('/dev/loading')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: () => <PortalLoading />,
});
