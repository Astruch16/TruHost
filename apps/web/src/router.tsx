import { createRouter } from '@tanstack/react-router';
import { MutationCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from '@truhost/api-client';
import { RouteLoading } from './components/shell/route-loading';
import { routeTree } from './routeTree.gen';

export const queryClient: QueryClient = new QueryClient({
  // Any successful change can move dashboard figures, so refresh them after every mutation.
  mutationCache: new MutationCache({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Don't retry what won't change: auth, permission, validation and not-found errors.
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    },
  },
});

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  // Pages load on first use. If one takes a moment, show its outline rather than nothing (and once shown, keep it
  // long enough not to flicker). Top-level pages show it at once: on a first visit there's nothing else to show.
  defaultPendingComponent: RouteLoading,
  defaultPendingMs: 200,
  defaultPendingMinMs: 300,
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
