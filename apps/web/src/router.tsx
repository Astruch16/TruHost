import { createRouter } from '@tanstack/react-router';
import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@truhost/api-client';
import { routeTree } from './routeTree.gen';

export const queryClient = new QueryClient({
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
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
