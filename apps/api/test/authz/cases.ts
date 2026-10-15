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
  /** Status an admin gets when the request is allowed but can't succeed with the fixture data. */
  adminGets?: number;
  /** Status every allowed actor gets when the request is allowed but can't succeed with the fixture data. */
  allowedGets?: number;
  /** Re-seed before each actor because the request changes state. */
  mutates?: boolean;
  /**
   * For routes authorised by something other than sign-in (signed storage links): every caller, signed in or
   * not, gets exactly this status.
   */
  everyoneGets?: number;
}

const A_READERS = ['admin', 'ownerA', 'cleanerA'] as const;
const B_READERS = ['admin', 'ownerB', 'cleanerB'] as const;
const ADMIN = ['admin'] as const;

export const CASES: AuthzCase[] = [
  // ── health, me, config ──
  { route: 'GET /v1/health', path: () => '/v1/health', allow: 'everyone', public: true },
  { route: 'GET /v1/me', path: () => '/v1/me', allow: 'everyone' },
  {
    route: 'PUT /v1/me/avatar',
    path: () => '/v1/me/avatar',
    // Everyone may set their own photo; with no upload in the fixture, the file isn't found (and never another's).
    body: () => ({ fileId: '00000000-0000-7000-8000-000000000000' }),
    allow: 'everyone',
    allowedGets: 422,
    mutates: true,
  },
  { route: 'DELETE /v1/me/avatar', path: () => '/v1/me/avatar', allow: 'everyone', mutates: true },
  { route: 'GET /v1/me/notification-settings', path: () => '/v1/me/notification-settings', allow: 'everyone' },
  {
    route: 'PUT /v1/me/notification-settings',
    path: () => '/v1/me/notification-settings',
    // Self-scoped: everyone may save their own (which categories apply is covered in me-settings.e2e-spec.ts).
    body: () => ({ items: [] }),
    allow: 'everyone',
    mutates: true,
  },
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
  {
    route: 'GET /v1/properties/:id/deletion',
    path: (w) => `/v1/properties/${w.propertyA.id}/deletion`,
    allow: ADMIN,
  },
  {
    route: 'DELETE /v1/properties/:id',
    path: (w) => `/v1/properties/${w.propertyA.id}`,
    // The fixture property has bookings, expenses and receipts, so even an admin can't delete it.
    allow: ADMIN,
    adminGets: 409,
    mutates: true,
  },
  {
    route: 'PUT /v1/properties/:id/cover-photo',
    path: (w) => `/v1/properties/${w.propertyA.id}/cover-photo`,
    // The fixture photo is already attached, so even an admin can't reuse its files.
    body: (w) => ({ fileId: w.photoA.fileId, thumbFileId: w.photoA.thumbFileId }),
    allow: ADMIN,
    adminGets: 422,
    mutates: true,
  },
  {
    route: 'DELETE /v1/properties/:id/cover-photo',
    path: (w) => `/v1/properties/${w.propertyA.id}/cover-photo`,
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
    body: () => ({ type: 'KITCHEN' }),
    allow: ADMIN,
    mutates: true,
  },
  {
    route: 'POST /v1/properties/:id/rooms/bulk',
    path: (w) => `/v1/properties/${w.propertyA.id}/rooms/bulk`,
    body: () => ({ rooms: [{ type: 'KITCHEN' }, { type: 'LIVING' }] }),
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
    body: () => ({ label: 'Primary' }),
    allow: ADMIN,
    mutates: true,
  },
  {
    route: 'POST /v1/rooms/:id/archive',
    path: (w) => `/v1/rooms/${w.propertyA.roomIds[0]}/archive`,
    allow: ADMIN,
    mutates: true,
  },

  // ── supplies ──
  {
    route: 'GET /v1/properties/:id/supplies',
    label: 'A',
    path: (w) => `/v1/properties/${w.propertyA.id}/supplies`,
    allow: A_READERS,
  },
  {
    route: 'GET /v1/properties/:id/supplies',
    label: 'B',
    path: (w) => `/v1/properties/${w.propertyB.id}/supplies`,
    allow: B_READERS,
  },
  {
    route: 'POST /v1/properties/:id/supplies',
    path: (w) => `/v1/properties/${w.propertyA.id}/supplies`,
    body: () => ({ name: 'Shampoo', category: 'BATHROOM' }),
    allow: ADMIN,
    mutates: true,
  },
  {
    route: 'POST /v1/properties/:id/supplies/bulk',
    path: (w) => `/v1/properties/${w.propertyA.id}/supplies/bulk`,
    body: () => ({ items: [{ name: 'Shampoo' }, { name: 'Dryer sheets', category: 'LAUNDRY' }] }),
    allow: ADMIN,
    mutates: true,
  },
  {
    route: 'POST /v1/properties/:id/supply-statuses',
    label: 'A',
    path: (w) => `/v1/properties/${w.propertyA.id}/supply-statuses`,
    body: (w) => ({ readings: [{ supplyItemId: w.propertyA.supplyIds[0], levelPct: 50 }] }),
    allow: ['admin', 'cleanerA'],
    mutates: true,
  },
  {
    route: 'POST /v1/properties/:id/supply-statuses',
    label: 'B',
    path: (w) => `/v1/properties/${w.propertyB.id}/supply-statuses`,
    body: (w) => ({ readings: [{ supplyItemId: w.propertyB.supplyIds[0], levelPct: 50 }] }),
    allow: ['admin', 'cleanerB'],
    mutates: true,
  },
  {
    route: 'PATCH /v1/supply-items/:id',
    path: (w) => `/v1/supply-items/${w.propertyA.supplyIds[0]}`,
    body: () => ({ thresholdPct: 40 }),
    allow: ADMIN,
    mutates: true,
  },
  {
    route: 'POST /v1/supply-items/:id/archive',
    path: (w) => `/v1/supply-items/${w.propertyA.supplyIds[0]}/archive`,
    allow: ADMIN,
    mutates: true,
  },
  {
    route: 'GET /v1/supply-items/:id/history',
    path: (w) => `/v1/supply-items/${w.propertyA.supplyIds[0]}/history`,
    allow: ['admin', 'ownerA'],
  },
  { route: 'GET /v1/supplies/restock', path: () => '/v1/supplies/restock', allow: ADMIN },

  // ── owner statements (admin only until the owner portal's statement pages) ──
  { route: 'GET /v1/statements', path: () => '/v1/statements?month=2026-10', allow: ADMIN },
  {
    route: 'POST /v1/statements/generate',
    path: () => '/v1/statements/generate',
    body: () => ({ month: '2026-10' }),
    allow: ADMIN,
    mutates: true,
  },
  {
    route: 'GET /v1/properties/:id/statements',
    label: 'property A',
    path: (w) => `/v1/properties/${w.propertyA.id}/statements`,
    allow: ADMIN,
  },
  {
    route: 'GET /v1/properties/:id/statements',
    label: 'property B',
    path: (w) => `/v1/properties/${w.propertyB.id}/statements`,
    allow: ADMIN,
  },
  {
    route: 'POST /v1/properties/:id/statements',
    path: (w) => `/v1/properties/${w.propertyA.id}/statements`,
    body: () => ({ month: '2026-11' }),
    allow: ADMIN,
    mutates: true,
  },
  { route: 'GET /v1/statements/:id', path: (w) => `/v1/statements/${w.statements.draftA}`, allow: ADMIN },
  {
    route: 'GET /v1/statements/:id/preview',
    path: (w) => `/v1/statements/${w.statements.draftA}/preview`,
    allow: ADMIN,
  },
  {
    route: 'POST /v1/statements/:id/finalize',
    path: (w) => `/v1/statements/${w.statements.draftA}/finalize`,
    body: () => ({ confirmPendingPayouts: false }),
    allow: ADMIN,
    mutates: true,
  },
  {
    route: 'POST /v1/statements/:id/release',
    path: (w) => `/v1/statements/${w.statements.finalizedB}/release`,
    body: () => ({ releasedOn: '2026-01-05', paymentReference: 'ETF-1' }),
    allow: ADMIN,
    mutates: true,
  },
  {
    route: 'POST /v1/statements/:id/adjustments',
    path: (w) => `/v1/statements/${w.statements.draftA}/adjustments`,
    body: () => ({ amountCents: -1_000, reason: 'Owner asked for a correction' }),
    allow: ADMIN,
    mutates: true,
  },
  {
    route: 'POST /v1/adjustments/:id/void',
    path: (w) => `/v1/adjustments/${w.statements.adjustmentA}/void`,
    body: () => ({ reason: 'Entered twice' }),
    allow: ADMIN,
    mutates: true,
  },

  // ── damage reports ──
  { route: 'GET /v1/damage-reports', path: () => '/v1/damage-reports?status=OPEN', allow: ADMIN },
  {
    route: 'GET /v1/properties/:id/damage-reports',
    label: 'A',
    path: (w) => `/v1/properties/${w.propertyA.id}/damage-reports`,
    allow: A_READERS,
  },
  {
    route: 'GET /v1/properties/:id/damage-reports',
    label: 'B',
    path: (w) => `/v1/properties/${w.propertyB.id}/damage-reports`,
    allow: B_READERS,
  },
  {
    route: 'POST /v1/properties/:id/damage-reports',
    path: (w) => `/v1/properties/${w.propertyA.id}/damage-reports`,
    body: () => ({
      title: 'Broken lamp',
      description: 'The bedside lamp base is cracked.',
      severity: 'MINOR',
      discoveredOn: '2026-10-01',
    }),
    allow: ['admin', 'cleanerA'],
    mutates: true,
  },
  {
    route: 'GET /v1/properties/:id/damage-report-stays',
    path: (w) => `/v1/properties/${w.propertyA.id}/damage-report-stays?on=2026-11-13`,
    allow: ['admin', 'cleanerA'],
  },
  {
    route: 'GET /v1/damage-reports/:id',
    label: 'sent',
    path: (w) => `/v1/damage-reports/${w.damage.sentA}`,
    allow: A_READERS,
  },
  {
    route: 'GET /v1/damage-reports/:id',
    label: 'draft',
    // A draft: its reporter and admins only (not the owner).
    path: (w) => `/v1/damage-reports/${w.damage.draftA}`,
    allow: ['admin', 'cleanerA'],
  },
  {
    route: 'PATCH /v1/damage-reports/:id',
    path: (w) => `/v1/damage-reports/${w.damage.draftA}`,
    body: () => ({ title: 'Chipped mug (kitchen)' }),
    allow: ['admin', 'cleanerA'],
    mutates: true,
  },
  {
    route: 'POST /v1/damage-reports/:id/photos',
    path: (w) => `/v1/damage-reports/${w.damage.draftA}/photos`,
    // With no upload in the fixture, the files aren't found (and never another's).
    body: () => ({
      fileId: '00000000-0000-7000-8000-000000000001',
      thumbFileId: '00000000-0000-7000-8000-000000000002',
    }),
    allow: ['admin', 'cleanerA'],
    allowedGets: 422,
    mutates: true,
  },
  {
    route: 'POST /v1/damage-reports/:id/submit',
    path: (w) => `/v1/damage-reports/${w.damage.draftA}/submit`,
    // The draft has no photos yet, so sending it is refused (422) for whoever may send it.
    allow: ['admin', 'cleanerA'],
    allowedGets: 422,
    mutates: true,
  },
  {
    route: 'POST /v1/damage-reports/:id/status',
    path: (w) => `/v1/damage-reports/${w.damage.sentA}/status`,
    body: () => ({ status: 'ACKNOWLEDGED' }),
    allow: ADMIN,
    mutates: true,
  },

  // ── notifications (self-scoped) ──
  { route: 'GET /v1/me/notifications', path: () => '/v1/me/notifications', allow: 'everyone' },
  {
    route: 'POST /v1/me/notifications/read',
    path: () => '/v1/me/notifications/read',
    body: () => ({ all: true }),
    allow: 'everyone',
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
  {
    route: 'POST /v1/properties/:id/plan/correct',
    path: (w) => `/v1/properties/${w.propertyA.id}/plan/correct`,
    body: (w) => ({ planId: w.planId }),
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

  // ── expenses & receipts ──
  { route: 'GET /v1/expenses', path: () => '/v1/expenses?from=2026-11-01&to=2026-12-01', allow: ADMIN },
  {
    route: 'GET /v1/properties/:id/expenses',
    label: 'A',
    path: (w) => `/v1/properties/${w.propertyA.id}/expenses?from=2026-11-01&to=2026-12-01`,
    allow: ['admin', 'ownerA'],
  },
  {
    route: 'GET /v1/properties/:id/expenses',
    label: 'B',
    path: (w) => `/v1/properties/${w.propertyB.id}/expenses?from=2026-11-01&to=2026-12-01`,
    allow: ['admin', 'ownerB'],
  },
  {
    route: 'POST /v1/properties/:id/expenses',
    path: (w) => `/v1/properties/${w.propertyA.id}/expenses`,
    body: () => ({ category: 'SUPPLIES', incurredOn: '2026-11-06', description: 'Soap', amountCents: 899 }),
    allow: ADMIN,
    mutates: true,
  },
  {
    route: 'PATCH /v1/expenses/:id',
    path: (w) => `/v1/expenses/${w.expenses.a}`,
    body: () => ({ version: 0, vendor: 'Other vendor' }),
    allow: ADMIN,
    mutates: true,
  },
  {
    route: 'POST /v1/expenses/:id/void',
    path: (w) => `/v1/expenses/${w.expenses.a}/void`,
    body: () => ({ reason: 'Entered twice' }),
    allow: ADMIN,
    mutates: true,
  },
  {
    route: 'GET /v1/properties/:id/receipts',
    label: 'A',
    path: (w) => `/v1/properties/${w.propertyA.id}/receipts?from=2026-11-01&to=2026-12-01`,
    allow: ['admin', 'ownerA'],
  },
  {
    route: 'GET /v1/properties/:id/receipts',
    label: 'B',
    path: (w) => `/v1/properties/${w.propertyB.id}/receipts?from=2026-11-01&to=2026-12-01`,
    allow: ['admin', 'ownerB'],
  },
  {
    // Admins reach validation (the file was never uploaded); everyone else is denied before that.
    route: 'POST /v1/properties/:id/receipts',
    path: (w) => `/v1/properties/${w.propertyA.id}/receipts`,
    body: () => ({ fileId: '00000000-0000-7000-8000-000000000000', receiptDate: '2026-11-05' }),
    allow: [],
    adminGets: 422,
    mutates: true,
  },
  {
    route: 'POST /v1/receipts/:id/void',
    path: (w) => `/v1/receipts/${w.receipts.a}/void`,
    body: () => ({ reason: 'Wrong file' }),
    allow: ADMIN,
    mutates: true,
  },

  // ── files ──
  {
    route: 'POST /v1/uploads',
    path: () => '/v1/uploads',
    body: (w) => ({
      purpose: 'RECEIPT',
      propertyId: w.propertyA.id,
      contentType: 'application/pdf',
      sizeBytes: 10,
      sha256: 'b'.repeat(64),
    }),
    allow: ADMIN,
    mutates: true,
  },
  {
    route: 'POST /v1/uploads',
    label: 'property photo',
    path: () => '/v1/uploads',
    body: (w) => ({
      purpose: 'PROPERTY_PHOTO',
      propertyId: w.propertyA.id,
      contentType: 'image/jpeg',
      sizeBytes: 10,
      sha256: 'b'.repeat(64),
    }),
    allow: ADMIN,
    mutates: true,
  },
  {
    route: 'GET /v1/files/:id/url',
    label: 'property A photo',
    path: (w) => `/v1/files/${w.photoA.thumbFileId}/url`,
    allow: A_READERS,
  },
  {
    route: 'GET /v1/files/:id/url',
    label: 'owner receipt A',
    path: (w) => `/v1/files/${w.files.a}/url`,
    allow: ['admin', 'ownerA'],
  },
  {
    route: 'GET /v1/files/:id/url',
    label: 'TruHost-borne receipt A',
    path: (w) => `/v1/files/${w.files.truhostA}/url`,
    allow: ['admin'],
  },
  {
    route: 'GET /v1/files/:id/url',
    label: 'owner receipt B',
    path: (w) => `/v1/files/${w.files.b}/url`,
    allow: ['admin', 'ownerB'],
  },
  {
    route: 'PUT /v1/local-storage/*key',
    label: 'unsigned',
    path: () => '/v1/local-storage/properties/x/receipt/y',
    allow: [],
    everyoneGets: 403,
  },
  {
    route: 'GET /v1/local-storage/*key',
    label: 'unsigned',
    path: () => '/v1/local-storage/properties/x/receipt/y',
    allow: [],
    everyoneGets: 403,
  },

  // ── reports ──
  {
    route: 'GET /v1/properties/:id/summary',
    label: 'A',
    path: (w) => `/v1/properties/${w.propertyA.id}/summary?month=2026-11`,
    allow: ['admin', 'ownerA'],
  },
  {
    route: 'GET /v1/properties/:id/summary',
    label: 'B',
    path: (w) => `/v1/properties/${w.propertyB.id}/summary?month=2026-11`,
    allow: ['admin', 'ownerB'],
  },
  {
    route: 'GET /v1/properties/:id/summary/monthly',
    path: (w) => `/v1/properties/${w.propertyA.id}/summary/monthly?year=2026`,
    allow: ['admin', 'ownerA'],
  },
  { route: 'GET /v1/reports/portfolio', path: () => '/v1/reports/portfolio?month=2026-11', allow: ADMIN },

  // ── dashboard ──
  { route: 'GET /v1/dashboard', path: () => '/v1/dashboard?month=2026-11', allow: ADMIN },

  // ── audit ──
  { route: 'GET /v1/audit-logs', path: () => '/v1/audit-logs', allow: ADMIN },
];
