import { useEffect } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { addMonths } from './months';

interface MonthQuery {
  queryKey: QueryKey;
  queryFn?: unknown;
}

/**
 * Loads the months either side of the one on screen in the background, so stepping to the next or previous month
 * shows it straight away, including the first step. `optionsFor` builds a month's query (from lib/queries); it runs
 * once `ready` (the shown month has loaded), so the page's own request goes first.
 */
export function usePrefetchAdjacentMonths(month: string, optionsFor: (month: string) => MonthQuery, ready: boolean) {
  const qc = useQueryClient();
  const neighbours = [addMonths(month, -1), addMonths(month, 1)].map(optionsFor);
  // The options are rebuilt every render; what they fetch is identified by their keys.
  const keys = JSON.stringify(neighbours.map((o) => o.queryKey));
  useEffect(() => {
    if (!ready) return;
    for (const { queryKey, queryFn } of neighbours) {
      void qc.prefetchQuery({ queryKey, queryFn: queryFn as () => Promise<unknown> });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, keys]);
}
