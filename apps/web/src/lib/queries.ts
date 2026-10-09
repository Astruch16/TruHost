import { queryOptions, type QueryKey } from '@tanstack/react-query';
import { unwrap, type ApiClient } from '@truhost/api-client';

/**
 * For reads by month: while another month loads, keep showing the one on screen (pages dim it) instead of falling
 * back to skeletons, as long as it is for the same property or scope. `scopeOf` picks that out of a query key.
 */
function keepWhileSameScope(scopeOf: (key: QueryKey) => unknown) {
  return <T>(previous: T | undefined, query: { queryKey: QueryKey } | undefined, key: QueryKey) =>
    query && scopeOf(query.queryKey) === scopeOf(key) ? previous : undefined;
}
const rangeScope = (key: QueryKey) => (key[1] as { propertyId?: string | null }).propertyId ?? null;

/**
 * Query definitions, one per API read. Keys are hierarchical so mutations can invalidate a whole
 * area (e.g. ['properties']).
 */
export const queries = {
  me: (api: ApiClient) =>
    queryOptions({ queryKey: ['me'], queryFn: () => unwrap(api.GET('/v1/me')), staleTime: 60_000 }),
  notificationSettings: (api: ApiClient) =>
    queryOptions({
      queryKey: ['me', 'notification-settings'],
      queryFn: () => unwrap(api.GET('/v1/me/notification-settings')),
    }),
  config: (api: ApiClient) =>
    queryOptions({ queryKey: ['config'], queryFn: () => unwrap(api.GET('/v1/config')), staleTime: Infinity }),
  properties: (api: ApiClient, includeArchived = false) =>
    queryOptions({
      queryKey: ['properties', { includeArchived }],
      queryFn: () =>
        unwrap(
          api.GET('/v1/properties', {
            params: { query: { includeArchived: includeArchived ? 'true' : 'false' } },
          }),
        ),
    }),
  property: (api: ApiClient, id: string) =>
    queryOptions({
      queryKey: ['properties', id],
      queryFn: () => unwrap(api.GET('/v1/properties/{id}', { params: { path: { id } } })),
    }),
  rooms: (api: ApiClient, propertyId: string, includeArchived = false) =>
    queryOptions({
      queryKey: ['properties', propertyId, 'rooms', { includeArchived }],
      queryFn: () =>
        unwrap(
          api.GET('/v1/properties/{id}/rooms', {
            params: { path: { id: propertyId }, query: { includeArchived: includeArchived ? 'true' : 'false' } },
          }),
        ),
    }),
  memberships: (api: ApiClient, propertyId: string) =>
    queryOptions({
      queryKey: ['properties', propertyId, 'memberships'],
      queryFn: () =>
        unwrap(
          api.GET('/v1/properties/{id}/memberships', {
            params: { path: { id: propertyId }, query: { includeRevoked: 'false' } },
          }),
        ),
    }),
  propertyPlan: (api: ApiClient, propertyId: string) =>
    queryOptions({
      queryKey: ['properties', propertyId, 'plan'],
      queryFn: () => unwrap(api.GET('/v1/properties/{id}/plan', { params: { path: { id: propertyId } } })),
    }),
  bookings: (api: ApiClient, range: { from: string; to: string }, propertyId?: string) => {
    const queryKey = ['bookings', { ...range, propertyId: propertyId ?? null }] as const;
    return queryOptions({
      queryKey,
      queryFn: () => unwrap(api.GET('/v1/bookings', { params: { query: { ...range, propertyId } } })),
      placeholderData: (prev, q) => keepWhileSameScope(rangeScope)(prev, q, queryKey),
    });
  },
  propertyBookings: (api: ApiClient, propertyId: string, range: { from: string; to: string }) => {
    const queryKey = ['bookings', { ...range, propertyId }, 'property'] as const;
    return queryOptions({
      queryKey,
      queryFn: () =>
        unwrap(api.GET('/v1/properties/{id}/bookings', { params: { path: { id: propertyId }, query: range } })),
      placeholderData: (prev, q) => keepWhileSameScope(rangeScope)(prev, q, queryKey),
    });
  },
  expenses: (api: ApiClient, range: { from: string; to: string }, propertyId?: string) => {
    const queryKey = ['expenses', { ...range, propertyId: propertyId ?? null }] as const;
    return queryOptions({
      queryKey,
      queryFn: () =>
        unwrap(api.GET('/v1/expenses', { params: { query: { ...range, propertyId, includeVoided: 'true' } } })),
      placeholderData: (prev, q) => keepWhileSameScope(rangeScope)(prev, q, queryKey),
    });
  },
  propertyExpenses: (api: ApiClient, propertyId: string, range: { from: string; to: string }) => {
    const queryKey = ['expenses', { ...range, propertyId }, 'property'] as const;
    return queryOptions({
      queryKey,
      queryFn: () =>
        unwrap(
          api.GET('/v1/properties/{id}/expenses', {
            params: { path: { id: propertyId }, query: { ...range, includeVoided: 'false' } },
          }),
        ),
      placeholderData: (prev, q) => keepWhileSameScope(rangeScope)(prev, q, queryKey),
    });
  },
  propertySummary: (api: ApiClient, propertyId: string, month: string) => {
    const queryKey = ['summary', propertyId, month] as const;
    return queryOptions({
      queryKey,
      queryFn: () =>
        unwrap(api.GET('/v1/properties/{id}/summary', { params: { path: { id: propertyId }, query: { month } } })),
      placeholderData: (prev, q) => keepWhileSameScope((k) => k[1])(prev, q, queryKey),
    });
  },
  dashboard: (api: ApiClient, month: string, propertyId: string | null) => {
    const queryKey = ['dashboard', month, propertyId] as const;
    return queryOptions({
      queryKey,
      queryFn: () =>
        unwrap(api.GET('/v1/dashboard', { params: { query: { month, propertyId: propertyId ?? undefined } } })),
      placeholderData: (prev, q) => keepWhileSameScope((k) => k[2])(prev, q, queryKey),
    });
  },
  plans: (api: ApiClient) => queryOptions({ queryKey: ['plans'], queryFn: () => unwrap(api.GET('/v1/plans')) }),
  users: (api: ApiClient) =>
    queryOptions({
      queryKey: ['users'],
      queryFn: () => unwrap(api.GET('/v1/users', { params: { query: { limit: 100 } } })),
    }),
  invites: (api: ApiClient) =>
    queryOptions({
      queryKey: ['invites'],
      queryFn: () => unwrap(api.GET('/v1/invites', { params: { query: { limit: 100 } } })),
    }),
};
