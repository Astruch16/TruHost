import { useContext } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import { ApiContext } from './api-context';
import { monthKey, monthRange } from './months';
import { queries } from './queries';
import { useScope } from './scope';

/**
 * Starts loading what the admin calendar shows for this month (properties, bookings and the month's figures, in the
 * property scope chosen), so a link to it can call this on hover or focus and the page opens complete, without
 * skeletons. Anything already loaded and fresh isn't fetched again. Does nothing outside the app's providers (tests,
 * fixture previews).
 */
export function usePrefetchCalendar(): () => void {
  const qc = useContext(QueryClientContext);
  const api = useContext(ApiContext);
  const { propertyId } = useScope();
  return () => {
    if (!qc || !api) return;
    const month = monthKey();
    void qc.prefetchQuery(queries.properties(api));
    void qc.prefetchQuery(queries.bookings(api, monthRange(month), propertyId ?? undefined));
    void qc.prefetchQuery(queries.dashboard(api, month, propertyId));
  };
}
