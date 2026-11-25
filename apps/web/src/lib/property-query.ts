import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { Property } from './api-types';
import { useApi } from './api-context';
import { queries } from './queries';

/**
 * One property, for its page. Opened from a property list, it shows at once from the list already loaded (the same
 * record) while the page's own copy loads behind it, so the page fades in whole instead of cutting to a skeleton.
 * `enabled` as for useQuery (the cleaner's page waits until it knows they clean there).
 */
export function useProperty(propertyId: string, { enabled = true }: { enabled?: boolean } = {}) {
  const api = useApi();
  const qc = useQueryClient();
  return useQuery({
    ...queries.property(api, propertyId),
    enabled,
    placeholderData: () => fromLists(qc, propertyId),
  });
}

/** The property as it appears in any property list already loaded (with or without archived ones). */
function fromLists(qc: QueryClient, propertyId: string): Property | undefined {
  for (const [key, data] of qc.getQueriesData<{ items: Property[] }>({ queryKey: ['properties'] })) {
    // Only the lists (['properties', { includeArchived }]), not one property or its rooms, plan or members.
    if (typeof key[1] !== 'object' || key[1] === null) continue;
    const hit = data?.items.find((p) => p.id === propertyId);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Starts loading what a property's page shows first (the property and its rooms) when the pointer or focus reaches a
 * link to it, so the page opens ready. Returns props for the link; anything already loaded and fresh isn't fetched
 * again.
 */
export function usePrefetchProperty(propertyId: string) {
  const api = useApi();
  const qc = useQueryClient();
  const prefetch = () => {
    void qc.prefetchQuery(queries.property(api, propertyId));
    void qc.prefetchQuery(queries.rooms(api, propertyId));
  };
  return { onMouseEnter: prefetch, onFocus: prefetch, onTouchStart: prefetch };
}
