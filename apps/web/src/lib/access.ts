import type { Me } from '@truhost/shared';

/**
 * Which screens to show this user. Convenience only: the API decides access on every call. Screens use these to
 * never render what a role can't use (e.g. no financial sections for a cleaner), rather than waiting for a 404.
 */
export const isAdmin = (me: Pick<Me, 'staffRole'>) => me.staffRole === 'ADMIN';

/** The user's role on one property (from their active memberships), or null for none. */
export function propertyRole(me: Pick<Me, 'memberships'>, propertyId: string): 'OWNER' | 'CLEANER' | null {
  return me.memberships.find((m) => m.property.id === propertyId)?.role ?? null;
}

/** Where a property opens for this user: the owner view, the cleaner view, or the admin page. */
export function propertyPath(me: Pick<Me, 'staffRole' | 'memberships'>, propertyId: string) {
  const role = propertyRole(me, propertyId);
  if (role === 'OWNER') return '/properties/$propertyId' as const;
  if (role === 'CLEANER') return '/cleaner/properties/$propertyId' as const;
  if (isAdmin(me)) return '/admin/properties/$propertyId' as const;
  return null;
}
