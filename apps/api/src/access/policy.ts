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
  /** A property's cleans and their photos. Cleaner pay only for admins and the clean's own cleaner (service). */
  'clean:read': { admin: true, roles: ['OWNER', 'CLEANER'] },
  /** Start a clean, add its photos and complete it: its assigned cleaner (checked in the service) or an admin. */
  'clean:work': { admin: true, roles: ['CLEANER'] },
  /**
   * Book an open clean (one with no cleaner yet) for oneself: the property's cleaners. Admins assign instead, so they
   * don't book.
   */
  'clean:book': { admin: false, roles: ['CLEANER'] },
  /** Act on any clean, and see every clean's pay. */
  'clean:manage': { admin: true, roles: [] },
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
  /**
   * The owner portal (/v1/owner/...): only properties where the caller holds an OWNER membership, admins included
   * (an admin who owns a property sees exactly what any owner would). Released statements only (checked in
   * OwnerService), no guest details, cleaner pay, TruHost's cleaning-fee revenue, notes or audit data.
   */
  'owner:portal': { admin: false, roles: ['OWNER'] },
  /** Owner statements in every state (the admin pages). Owners read theirs through 'owner:portal'. */
  'statement:read': { admin: true, roles: [] },
  /** Create drafts, add and void adjustments, finalize, release. */
  'statement:manage': { admin: true, roles: [] },
  'user:manage': { admin: true, roles: [] },
  'invite:manage': { admin: true, roles: [] },
  'audit:read': { admin: true, roles: [] },
  /**
   * Ask for time off: anyone who cleans a property (checked with canAnywhere: time off is the cleaner's, not a
   * property's). They see and cancel only their own.
   */
  'timeOff:request': { admin: false, roles: ['CLEANER'] },
  /** Every cleaner's time off: see it, approve or decline it. */
  'timeOff:manage': { admin: true, roles: [] },
} as const satisfies Record<string, { admin: boolean; roles: readonly MembershipRole[] }>;

export type Action = keyof typeof POLICY;
