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
  /** Supplies sit under one key, so a reading refreshes every list that shows it (property and restock). */
  supplies: (api: ApiClient, propertyId: string) =>
    queryOptions({
      queryKey: ['supplies', 'property', propertyId],
      queryFn: () => unwrap(api.GET('/v1/properties/{id}/supplies', { params: { path: { id: propertyId } } })),
    }),
  supplyHistory: (api: ApiClient, itemId: string) =>
    queryOptions({
      queryKey: ['supplies', 'history', itemId],
      queryFn: () => unwrap(api.GET('/v1/supply-items/{id}/history', { params: { path: { id: itemId } } })),
    }),
  restock: (api: ApiClient) =>
    queryOptions({ queryKey: ['supplies', 'restock'], queryFn: () => unwrap(api.GET('/v1/supplies/restock')) }),
  /** Damage reports sit under one key, so any change refreshes every list that shows them. */
  damageReports: (api: ApiClient, status: 'OPEN' | 'RESOLVED' | 'ALL', propertyId?: string) =>
    queryOptions({
      queryKey: ['damage', 'all', { status, propertyId: propertyId ?? null }],
      queryFn: () => unwrap(api.GET('/v1/damage-reports', { params: { query: { status, propertyId } } })),
    }),
  propertyDamage: (api: ApiClient, propertyId: string) =>
    queryOptions({
      queryKey: ['damage', 'property', propertyId],
      queryFn: () => unwrap(api.GET('/v1/properties/{id}/damage-reports', { params: { path: { id: propertyId } } })),
    }),
  damageReport: (api: ApiClient, id: string) =>
    queryOptions({
      queryKey: ['damage', 'report', id],
      queryFn: () => unwrap(api.GET('/v1/damage-reports/{id}', { params: { path: { id } } })),
    }),
  damageStays: (api: ApiClient, propertyId: string, on: string) =>
    queryOptions({
      queryKey: ['damage', 'stays', propertyId, on],
      queryFn: () =>
        unwrap(
          api.GET('/v1/properties/{id}/damage-report-stays', {
            params: { path: { id: propertyId }, query: { on } },
          }),
        ),
    }),
  /** Statements sit under one key, so any change (a draft, a finalize, an adjustment) refreshes every view of them. */
  statementMonth: (api: ApiClient, month: string) =>
    queryOptions({
      queryKey: ['statements', 'month', month],
      queryFn: () => unwrap(api.GET('/v1/statements', { params: { query: { month } } })),
      // Keep the month on screen (dimmed) while the next one loads.
      placeholderData: (previous) => previous,
    }),
  statement: (api: ApiClient, id: string) =>
    queryOptions({
      queryKey: ['statements', 'one', id],
      queryFn: () => unwrap(api.GET('/v1/statements/{id}', { params: { path: { id } } })),
    }),
  /** The owner portal: the caller's owned properties only (the API scopes every read). */
  ownerProperties: (api: ApiClient) =>
    queryOptions({ queryKey: ['owner', 'properties'], queryFn: () => unwrap(api.GET('/v1/owner/properties')) }),
  ownerHome: (api: ApiClient, propertyId: string | null) =>
    queryOptions({
      queryKey: ['owner', 'home', { propertyId }],
      queryFn: () => unwrap(api.GET('/v1/owner/home', { params: { query: { propertyId: propertyId ?? undefined } } })),
    }),
  ownerStatements: (api: ApiClient, propertyId: string | null) =>
    queryOptions({
      queryKey: ['owner', 'statements', { propertyId }],
      queryFn: () =>
        unwrap(api.GET('/v1/owner/statements', { params: { query: { propertyId: propertyId ?? undefined } } })),
    }),
  ownerStatement: (api: ApiClient, id: string) =>
    queryOptions({
      queryKey: ['owner', 'statement', id],
      queryFn: () => unwrap(api.GET('/v1/owner/statements/{id}', { params: { path: { id } } })),
    }),
  ownerSupplies: (api: ApiClient, propertyId: string | null) =>
    queryOptions({
      queryKey: ['owner', 'supplies', { propertyId }],
      queryFn: () =>
        unwrap(api.GET('/v1/owner/supplies', { params: { query: { propertyId: propertyId ?? undefined } } })),
    }),
  ownerDamage: (api: ApiClient, propertyId: string | null) =>
    queryOptions({
      queryKey: ['owner', 'damage', { propertyId }],
      queryFn: () =>
        unwrap(api.GET('/v1/owner/damage', { params: { query: { propertyId: propertyId ?? undefined } } })),
    }),
  ownerDamageReport: (api: ApiClient, id: string) =>
    queryOptions({
      queryKey: ['owner', 'damage', 'report', id],
      queryFn: () => unwrap(api.GET('/v1/owner/damage/{id}', { params: { path: { id } } })),
    }),
  ownerCalendar: (api: ApiClient, month: string, propertyId: string | null) =>
    queryOptions({
      queryKey: ['owner', 'calendar', { month, propertyId }],
      queryFn: () =>
        unwrap(api.GET('/v1/owner/calendar', { params: { query: { month, propertyId: propertyId ?? undefined } } })),
      placeholderData: (previous) => previous,
    }),
  /** The bell: checked every minute while the app is open. */
  notifications: (api: ApiClient) =>
    queryOptions({
      queryKey: ['me', 'notifications'],
      queryFn: () => unwrap(api.GET('/v1/me/notifications', { params: { query: { unread: 'false' } } })),
      refetchInterval: 60_000,
    }),
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
