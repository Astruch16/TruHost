import { useRouterState } from '@tanstack/react-router';
import { isAuthPath, useInShell } from '../../lib/shell-context';
import { PageSkeleton } from './page-skeleton';
import { PortalLoading } from './portal-loading';

/**
 * Shown while a page's code downloads (pages load on first use). Inside the portal it fills the content area;
 * for a sign-in page it holds the night sky; anywhere else it is the portal's own loading screen. So there is never
 * a blank screen, whatever the connection.
 */
export function RouteLoading() {
  const inShell = useInShell();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (inShell) {
    return (
      <div role="status" aria-label="Loading">
        <PageSkeleton />
      </div>
    );
  }
  if (isAuthPath(pathname)) {
    return (
      <div
        role="status"
        aria-label="Loading"
        className="min-h-dvh bg-[linear-gradient(#08141f,#102638_40%,#1a4042_64%,#2b584f)]"
      />
    );
  }
  return <PortalLoading />;
}
