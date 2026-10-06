import type { ActorKey, World } from '../support/world.js';

/**
 * The authorization matrix (CLAUDE.md rule 1). One entry per route; `route` must match the
 * router exactly (the meta-test enforces full coverage). Every case is run as every actor and as
 * an anonymous caller:
 *   - actors in `allow` must get a 2xx,
 *   - everyone else must get 404 (never 403: other properties are invisible),
 *   - anonymous callers get 401 unless the route is public.
 */
export interface AuthzCase {
  route: string;
  /** Distinguishes several cases for the same route (e.g. property A vs B). */
  label?: string;
  path: (w: World) => string;
  body?: (w: World) => object;
  allow: readonly ActorKey[] | 'everyone';
  public?: boolean;
  /** Re-seed before each actor because the request changes state. */
  mutates?: boolean;
}

const A_READERS = ['admin', 'ownerA', 'cleanerA'] as const;
const B_READERS = ['admin', 'ownerB', 'cleanerB'] as const;
const ADMIN = ['admin'] as const;

export const CASES: AuthzCase[] = [
  // ── health, me, config ──
  { route: 'GET /v1/health', path: () => '/v1/health', allow: 'everyone', public: true },
  { route: 'GET /v1/me', path: () => '/v1/me', allow: 'everyone' },
  {
    route: 'PATCH /v1/me',
    path: () => '/v1/me',
    body: () => ({ phone: '604-555-0100' }),
    allow: 'everyone',
    mutates: true,
  },
  { route: 'GET /v1/config', path: () => '/v1/config', allow: 'everyone' },

  // ── users ──
  { route: 'GET /v1/users', path: () => '/v1/users', allow: ADMIN },
  { route: 'GET /v1/users/:id', path: (w) => `/v1/users/${w.users.ownerA.id}`, allow: ADMIN },
  {
    route: 'PATCH /v1/users/:id',
    path: (w) => `/v1/users/${w.users.ownerB.id}`,
    body: () => ({ phone: '604-555-0101' }),
    allow: ADMIN,
    mutates: true,
  },
  {
    route: 'POST /v1/users/:id/deactivate',
    path: (w) => `/v1/users/${w.users.outsider.id}/deactivate`,
    allow: ADMIN,
    mutates: true,
  },

  // ── invites ──
  {
    route: 'POST /v1/invites',
    path: () => '/v1/invites',
    body: (w) => ({
      email: 'new.cleaner@example.test',
      firstName: 'New',
      lastName: 'Cleaner',
      memberships: [{ propertyId: w.propertyA.id, role: 'CLEANER' }],
    }),
    allow: ADMIN,
    mutates: true,
  },
  { route: 'GET /v1/invites', path: () => '/v1/invites', allow: ADMIN },
  {
    route: 'POST /v1/invites/:id/resend',
    path: (w) => `/v1/invites/${w.pendingInviteId}/resend`,
    allow: ADMIN,
    mutates: true,
  },
  {
    route: 'POST /v1/invites/:id/revoke',
    path: (w) => `/v1/invites/${w.pendingInviteId}/revoke`,
    allow: ADMIN,
    mutates: true,
  },

  // ── properties ──
  // The list is scoped rather than denied; its contents are checked in properties.e2e-spec.ts.
  { route: 'GET /v1/properties', path: () => '/v1/properties', allow: 'everyone' },
  {
    route: 'POST /v1/properties',
    path: () => '/v1/properties',
    body: () => ({ name: 'New', addressLine1: '9 New St', city: 'Vancouver', postalCode: 'V5K 0A1' }),
    allow: ADMIN,
    mutates: true,
  },
  { route: 'GET /v1/properties/:id', label: 'A', path: (w) => `/v1/properties/${w.propertyA.id}`, allow: A_READERS },
  { route: 'GET /v1/properties/:id', label: 'B', path: (w) => `/v1/properties/${w.propertyB.id}`, allow: B_READERS },
  {
    route: 'PATCH /v1/properties/:id',
    path: (w) => `/v1/properties/${w.propertyA.id}`,
    body: () => ({ name: 'Renamed' }),
    allow: ADMIN,
    mutates: true,
  },
  {
    route: 'POST /v1/properties/:id/archive',
    path: (w) => `/v1/properties/${w.propertyA.id}/archive`,
    allow: ADMIN,
    mutates: true,
  },

  // ── memberships ──
  {
    route: 'GET /v1/properties/:id/memberships',
    path: (w) => `/v1/properties/${w.propertyA.id}/memberships`,
    allow: ADMIN,
  },
  {
    route: 'POST /v1/properties/:id/memberships',
    path: (w) => `/v1/properties/${w.propertyA.id}/memberships`,
    body: (w) => ({ userId: w.users.outsider.id, role: 'CLEANER' }),
    allow: ADMIN,
    mutates: true,
  },
  {
    route: 'POST /v1/memberships/:id/revoke',
    path: (w) => `/v1/memberships/${w.memberships.cleanerA}/revoke`,
    allow: ADMIN,
    mutates: true,
  },

  // ── rooms ──
  {
    route: 'GET /v1/properties/:id/rooms',
    label: 'A',
    path: (w) => `/v1/properties/${w.propertyA.id}/rooms`,
    allow: A_READERS,
  },
  {
    route: 'GET /v1/properties/:id/rooms',
    label: 'B',
    path: (w) => `/v1/properties/${w.propertyB.id}/rooms`,
    allow: B_READERS,
  },
  {
    route: 'POST /v1/properties/:id/rooms',
    path: (w) => `/v1/properties/${w.propertyA.id}/rooms`,
    body: () => ({ name: 'Kitchen', type: 'KITCHEN' }),
    allow: ADMIN,
    mutates: true,
  },
  {
    route: 'PUT /v1/properties/:id/rooms/order',
    path: (w) => `/v1/properties/${w.propertyA.id}/rooms/order`,
    body: (w) => ({ roomIds: [...w.propertyA.roomIds].reverse() }),
    allow: ADMIN,
    mutates: true,
  },
  {
    route: 'PATCH /v1/rooms/:id',
    path: (w) => `/v1/rooms/${w.propertyA.roomIds[0]}`,
    body: () => ({ name: 'Primary bedroom' }),
    allow: ADMIN,
    mutates: true,
  },
  {
    route: 'POST /v1/rooms/:id/archive',
    path: (w) => `/v1/rooms/${w.propertyA.roomIds[0]}/archive`,
    allow: ADMIN,
    mutates: true,
  },

  // ── plans ──
  { route: 'GET /v1/plans', path: () => '/v1/plans', allow: ADMIN },
  {
    route: 'POST /v1/plans',
    path: () => '/v1/plans',
    body: () => ({ name: 'Other plan', managementFeeBps: 2000 }),
    allow: ADMIN,
    mutates: true,
  },
  {
    route: 'PATCH /v1/plans/:id',
    path: (w) => `/v1/plans/${w.planId}`,
    body: () => ({ description: 'Full service' }),
    allow: ADMIN,
    mutates: true,
  },
  { route: 'POST /v1/plans/:id/archive', path: (w) => `/v1/plans/${w.planId}/archive`, allow: ADMIN, mutates: true },
  {
    route: 'GET /v1/properties/:id/plan',
    label: 'A',
    path: (w) => `/v1/properties/${w.propertyA.id}/plan`,
    allow: ['admin', 'ownerA'],
  },
  {
    route: 'GET /v1/properties/:id/plan',
    label: 'B',
    path: (w) => `/v1/properties/${w.propertyB.id}/plan`,
    allow: ['admin', 'ownerB'],
  },
  {
    route: 'POST /v1/properties/:id/plan',
    path: (w) => `/v1/properties/${w.propertyA.id}/plan`,
    body: (w) => ({ planId: w.planId, effectiveFrom: '2027-01-01' }),
    allow: ADMIN,
    mutates: true,
  },

  // ── bookings ──
  { route: 'GET /v1/bookings', path: () => '/v1/bookings?from=2026-11-01&to=2026-12-01', allow: ADMIN },
  {
    route: 'GET /v1/properties/:id/bookings',
    label: 'A',
    path: (w) => `/v1/properties/${w.propertyA.id}/bookings?from=2026-11-01&to=2026-12-01`,
    allow: ['admin', 'ownerA'],
  },
  {
    route: 'GET /v1/properties/:id/bookings',
    label: 'B',
    path: (w) => `/v1/properties/${w.propertyB.id}/bookings?from=2026-11-01&to=2026-12-01`,
    allow: ['admin', 'ownerB'],
  },
  {
    route: 'POST /v1/properties/:id/bookings',
    path: (w) => `/v1/properties/${w.propertyA.id}/bookings`,
    body: () => ({ channel: 'AIRBNB', checkInDate: '2026-12-01', checkOutDate: '2026-12-04' }),
    allow: ADMIN,
    mutates: true,
  },
  {
    route: 'GET /v1/bookings/:id',
    label: 'A',
    path: (w) => `/v1/bookings/${w.bookings.a}`,
    allow: ['admin', 'ownerA'],
  },
  {
    route: 'GET /v1/bookings/:id',
    label: 'B',
    path: (w) => `/v1/bookings/${w.bookings.b}`,
    allow: ['admin', 'ownerB'],
  },
  {
    route: 'PATCH /v1/bookings/:id',
    path: (w) => `/v1/bookings/${w.bookings.a}`,
    body: () => ({ version: 0, guestCount: 2 }),
    allow: ADMIN,
    mutates: true,
  },
  {
    route: 'POST /v1/bookings/:id/cancel',
    path: (w) => `/v1/bookings/${w.bookings.a}/cancel`,
    body: () => ({ version: 0 }),
    allow: ADMIN,
    mutates: true,
  },

  // ── audit ──
  { route: 'GET /v1/audit-logs', path: () => '/v1/audit-logs', allow: ADMIN },
];
