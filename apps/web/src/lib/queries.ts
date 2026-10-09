import { queryOptions } from '@tanstack/react-query';
import { unwrap, type ApiClient } from '@truhost/api-client';

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
  bookings: (api: ApiClient, range: { from: string; to: string }, propertyId?: string) =>
    queryOptions({
      queryKey: ['bookings', { ...range, propertyId: propertyId ?? null }],
      queryFn: () => unwrap(api.GET('/v1/bookings', { params: { query: { ...range, propertyId } } })),
    }),
  propertyBookings: (api: ApiClient, propertyId: string, range: { from: string; to: string }) =>
    queryOptions({
      queryKey: ['bookings', { ...range, propertyId }, 'property'],
      queryFn: () =>
        unwrap(api.GET('/v1/properties/{id}/bookings', { params: { path: { id: propertyId }, query: range } })),
    }),
  expenses: (api: ApiClient, range: { from: string; to: string }, propertyId?: string) =>
    queryOptions({
      queryKey: ['expenses', { ...range, propertyId: propertyId ?? null }],
      queryFn: () =>
        unwrap(api.GET('/v1/expenses', { params: { query: { ...range, propertyId, includeVoided: 'true' } } })),
    }),
  propertyExpenses: (api: ApiClient, propertyId: string, range: { from: string; to: string }) =>
    queryOptions({
      queryKey: ['expenses', { ...range, propertyId }, 'property'],
      queryFn: () =>
        unwrap(
          api.GET('/v1/properties/{id}/expenses', {
            params: { path: { id: propertyId }, query: { ...range, includeVoided: 'false' } },
          }),
        ),
    }),
  propertySummary: (api: ApiClient, propertyId: string, month: string) =>
    queryOptions({
      queryKey: ['summary', propertyId, month],
      queryFn: () =>
        unwrap(api.GET('/v1/properties/{id}/summary', { params: { path: { id: propertyId }, query: { month } } })),
    }),
  dashboard: (api: ApiClient, month: string, propertyId: string | null) =>
    queryOptions({
      queryKey: ['dashboard', month, propertyId],
      queryFn: () =>
        unwrap(api.GET('/v1/dashboard', { params: { query: { month, propertyId: propertyId ?? undefined } } })),
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
