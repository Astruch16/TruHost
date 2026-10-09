import { useEffect, useState } from 'react';
import { cx } from '../../lib/cx';
import { beginLoading, endLoading, useLoadStage, useOnline } from '../../lib/use-load-stage';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Spinner } from '../ui/spinner';
import { PageSkeleton } from './page-skeleton';
import { Logo } from './logo';
import { MountainScene } from './mountain-scene';

/**
 * What people see between signing in and the portal being ready: the portal's own frame (the real sidebar look,
 * top bar, page layout) as placeholders, with a calm status line. Same grid and widths as AppShell, so nothing
 * jumps when the real portal replaces it.
 *
 * It replaces a page that is already gone (sign-in, or nothing yet), so it fades in at once rather than leaving a
 * blank screen; one that continues a loading screen already showing appears without a fade. On a slow connection
 * it says so after a few seconds, offers to try again after a while, and notices when the device is offline.
 */
export function PortalLoading({ onRetry }: { onRetry?: () => void }) {
  const [session] = useState(() => beginLoading());
  useEffect(() => () => endLoading(), []);
  const stage = useLoadStage(session.since);
  const online = useOnline();
  const message = !online
    ? 'You’re offline. We’ll carry on as soon as your connection is back.'
    : stage === 'loading'
      ? 'Loading your portal…'
      : stage === 'slow'
        ? 'Still loading. This can take a moment on a slower connection.'
        : 'This is taking longer than usual. Check your connection, or try again.';

  return (
    <div
      className={cx(
        'min-h-dvh bg-ground lg:grid lg:grid-cols-[248px_minmax(0,1fr)]',
        !session.instant && 'animate-fade-in',
      )}
    >
      <aside aria-hidden className="sticky top-0 hidden h-dvh lg:block">
        <SidebarPlaceholder />
      </aside>

      <div className="@container/content flex min-w-0 flex-col">
        <header
          aria-hidden
          className="mx-auto flex w-full max-w-[1680px] items-center gap-2 px-4 pt-4 @2xl/content:px-8 @2xl/content:pt-6 @[100rem]/content:px-10"
        >
          <Skeleton className="size-11 rounded-full lg:hidden" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-12 w-[min(100%,18rem)] rounded-full" />
          </div>
          <Skeleton className="size-11 rounded-full" />
          <Skeleton className="hidden h-12 w-44 rounded-full sm:block" />
          <Skeleton className="size-11 rounded-full sm:hidden" />
        </header>

        <main className="mx-auto w-full max-w-[1680px] flex-1 px-4 py-6 @2xl/content:px-8 @2xl/content:py-8 @[100rem]/content:px-10">
          <div
            role="status"
            aria-live="polite"
            className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-medium text-muted"
          >
            {online && stage !== 'stuck' && <Spinner className="size-4 text-sage-deep" />}
            <span>{message}</span>
            {stage === 'stuck' && (
              <Button variant="secondary" size="sm" onClick={onRetry ?? (() => window.location.reload())}>
                Try again
              </Button>
            )}
          </div>

          <PageSkeleton />
        </main>
      </div>
    </div>
  );
}

/** The sidebar as it will look, with placeholders where the role's menu will be. */
function SidebarPlaceholder() {
  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-sidebar">
      <div className="px-6 pt-7 pb-8">
        <Logo />
      </div>
      <div className="flex flex-col gap-1 px-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex min-h-12 items-center gap-3 px-3.5">
            <div className="animate-skeleton size-[18px] rounded-md bg-white/12" />
            <div
              className="animate-skeleton h-3.5 rounded bg-white/12"
              style={{ width: `${[58, 52, 64, 48, 56, 42][i]}%` }}
            />
          </div>
        ))}
      </div>
      <div className="sidebar-foot pointer-events-none relative mt-auto min-h-0 flex-1 basis-0 overflow-hidden">
        <MountainScene className="sidebar-scene absolute inset-x-0 bottom-0 h-[min(330px,100%)] w-full" />
        <p className="sidebar-tagline absolute inset-x-0 bottom-[296px] -rotate-3 px-6 text-center font-hand text-[1.75rem] leading-[1.15] text-sidebar-ink/90">
          Better stays.
          <br />
          Higher returns.
        </p>
      </div>
    </div>
  );
}
