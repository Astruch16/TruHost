import { useEffect, useRef } from 'react';
import { useAuth } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Forgets everything cached when the signed-in user changes: signing out, or someone else signing in on the same tab.
 * Sign-out stays inside the app (no page load), so without this the next person would briefly get the last one's
 * profile, which decides where they land and whether they're welcomed, and their figures. Renders nothing.
 */
export function ClearCacheOnUserChange() {
  const { isLoaded, userId } = useAuth();
  const queryClient = useQueryClient();
  const last = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!isLoaded) return;
    const current = userId ?? null;
    if (last.current !== undefined && last.current !== current) queryClient.clear();
    last.current = current;
  }, [isLoaded, userId, queryClient]);
  return null;
}
