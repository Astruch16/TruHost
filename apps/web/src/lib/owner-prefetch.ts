import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ApiClient } from '@truhost/api-client';
import { queries } from './queries';

/** The most properties loaded ahead of time (an owner with more loads the rest on demand). */
const MAX_AHEAD = 6;

/**
 * Loads the owner's other switcher choices in the background once the current page has settled: each property (and
 * "All properties"), its home, supplies and the month its earnings card opens on. Switching is then instant
 * instead of waiting on the network. Best effort: failures are left for the page to retry when it's opened.
 */
export function usePrefetchOwnerScopes(
  api: ApiClient,
  propertyIds: readonly string[],
  current: string | null,
  ready: boolean,
) {
  const qc = useQueryClient();
  const key = propertyIds.join(',');
  useEffect(() => {
    if (!ready || propertyIds.length < 2) return;
    const scopes: (string | null)[] = [null, ...propertyIds.slice(0, MAX_AHEAD)].filter((s) => s !== current);
    let cancelled = false;
    // Wait for the browser to be idle-ish, so the page on screen gets the network first.
    const timer = setTimeout(() => {
      for (const scope of scopes) {
        if (cancelled) return;
        void qc.prefetchQuery(queries.ownerSupplies(api, scope));
        void qc
          .fetchQuery(queries.ownerHome(api, scope))
          .then((home) => {
            if (!cancelled) void qc.prefetchQuery(queries.ownerMonth(api, home.latest?.month ?? home.month, scope));
          })
          .catch(() => undefined);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands in for the ids array
  }, [api, qc, key, current, ready]);
}
