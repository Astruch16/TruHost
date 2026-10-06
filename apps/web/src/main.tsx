import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { ApiProvider } from './lib/api';
import { queryClient, router } from './router';
import './styles.css';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!publishableKey) {
  throw new Error('VITE_CLERK_PUBLISHABLE_KEY is not set (see .env.example)');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={publishableKey}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignOutUrl="/sign-in"
      routerPush={(to) => router.navigate({ to })}
      routerReplace={(to) => router.navigate({ to, replace: true })}
    >
      <ApiProvider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </ApiProvider>
    </ClerkProvider>
  </StrictMode>,
);
