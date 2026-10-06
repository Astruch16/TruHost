import { useMemo, type ReactNode } from 'react';
import { useAuth } from '@clerk/react';
import { createApiClient } from '@truhost/api-client';
import { ApiContext } from './api-context';

/** Provides the typed API client, authenticated with the current Clerk session token. */
export function ApiProvider({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();
  const client = useMemo(
    () => createApiClient({ baseUrl: import.meta.env.VITE_API_URL, getToken: () => getToken() }),
    [getToken],
  );
  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}
