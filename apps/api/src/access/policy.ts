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
  'plan:manage': { admin: true, roles: [] },
  'propertyPlan:read': { admin: true, roles: ['OWNER'] },
  'propertyPlan:assign': { admin: true, roles: [] },
  'user:manage': { admin: true, roles: [] },
  'invite:manage': { admin: true, roles: [] },
  'audit:read': { admin: true, roles: [] },
} as const satisfies Record<string, { admin: boolean; roles: readonly MembershipRole[] }>;

export type Action = keyof typeof POLICY;
