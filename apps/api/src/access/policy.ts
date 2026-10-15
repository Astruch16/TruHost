import type { MembershipRole } from '../generated/prisma/enums.js';

/**
 * THE authorization table (CLAUDE.md rule 1, docs/spec.md §7). Every access decision in the API
 * reads from here via AccessService. Adding an action means adding a row; adding a route means
 * adding authz matrix cases in test/authz.
 *
 * - admin: whether ADMIN staff may perform it (on any property).
 * - roles: membership roles that may perform it on properties where they hold that role.
 *   An action with no roles is admin-only.
 */
export const POLICY = {
  'property:read': { admin: true, roles: ['OWNER', 'CLEANER'] },
  'property:write': { admin: true, roles: [] },
  /** Default cleaner, cleaner pay and standard cleaning fee. */
  'property:readAdminFields': { admin: true, roles: [] },
  'membership:manage': { admin: true, roles: [] },
  'room:read': { admin: true, roles: ['OWNER', 'CLEANER'] },
  'room:write': { admin: true, roles: [] },
  /** The property's supplies and their current levels. */
  'supply:read': { admin: true, roles: ['OWNER', 'CLEANER'] },
  /** Add, rename, re-threshold and archive supply items. */
  'supply:write': { admin: true, roles: [] },
  /** Report how full items are (cleaners do this on site). */
  'supply:record': { admin: true, roles: ['CLEANER'] },
  /** Past readings of an item, with who reported them. */
  'supply:history': { admin: true, roles: ['OWNER'] },
  /** What needs restocking across every property. */
  'supply:restock': { admin: true, roles: [] },
  /** Damage reports at a property: owners see sent ones; cleaners see sent ones and their own drafts (service). */
  'damage:read': { admin: true, roles: ['OWNER', 'CLEANER'] },
  /** Report damage (and add photos to, edit and send one's own reports). */
  'damage:report': { admin: true, roles: ['CLEANER'] },
  /** Move reports on (acknowledged, claim filed, resolved) and act on anyone's. */
  'damage:manage': { admin: true, roles: [] },
  'plan:manage': { admin: true, roles: [] },
  'propertyPlan:read': { admin: true, roles: ['OWNER'] },
  'propertyPlan:assign': { admin: true, roles: [] },
  'booking:read': { admin: true, roles: ['OWNER'] },
  /** Guest details, raw payout and cleaning fee, notes. */
  'booking:readAdminFields': { admin: true, roles: [] },
  'booking:write': { admin: true, roles: [] },
  /** Owners see owner-borne, non-voided expenses only (filtered in the service). */
  'expense:read': { admin: true, roles: ['OWNER'] },
  /** TruHost-borne and voided expenses, void reasons, versions. */
  'expense:readAdminFields': { admin: true, roles: [] },
  'expense:write': { admin: true, roles: [] },
  /** Owners see receipts on their owner-borne, non-voided expenses. */
  'receipt:read': { admin: true, roles: ['OWNER'] },
  'receipt:write': { admin: true, roles: [] },
  'report:property': { admin: true, roles: ['OWNER'] },
  /** TruHost-side figures (cleaning fees collected). */
  'report:adminFields': { admin: true, roles: [] },
  'report:portfolio': { admin: true, roles: [] },
  'dashboard:read': { admin: true, roles: [] },
  /** Owner statements and their PDFs. Admin-only until the owner portal's statement pages (they add OWNER here). */
  'statement:read': { admin: true, roles: [] },
  /** Create drafts, add and void adjustments, finalize, release. */
  'statement:manage': { admin: true, roles: [] },
  'user:manage': { admin: true, roles: [] },
  'invite:manage': { admin: true, roles: [] },
  'audit:read': { admin: true, roles: [] },
} as const satisfies Record<string, { admin: boolean; roles: readonly MembershipRole[] }>;

export type Action = keyof typeof POLICY;
