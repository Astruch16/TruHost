import { Injectable } from '@nestjs/common';
import type { Actor } from '../auth/actor.js';
import { notFound } from '../common/problem.js';
import { POLICY, type Action } from './policy.js';

/**
 * The single place that answers "may this actor do this?" Services call it; controllers and the
 * web app never decide access. Denials are 404 so callers can't probe for other properties.
 */
@Injectable()
export class AccessService {
  isAdmin(actor: Actor): boolean {
    return actor.staffRole === 'ADMIN';
  }

  /** True if the actor may perform `action` on `propertyId` (or globally, for admin-only actions). */
  can(actor: Actor, action: Action, propertyId?: string): boolean {
    const rule = POLICY[action];
    if (rule.admin && this.isAdmin(actor)) return true;
    if (!propertyId) return false;
    const roles: readonly string[] = rule.roles;
    return actor.memberships.some((m) => m.propertyId === propertyId && roles.includes(m.role));
  }

  assert(actor: Actor, action: Action, propertyId?: string, what = 'Resource'): void {
    if (!this.can(actor, action, propertyId)) throw notFound(what);
  }

  /**
   * Property ids the actor may perform `action` on, or `'all'` for admins. Use it to scope list
   * queries: `where: { propertyId: { in: ids } }`.
   */
  propertyIds(actor: Actor, action: Action): 'all' | string[] {
    const rule = POLICY[action];
    if (rule.admin && this.isAdmin(actor)) return 'all';
    const roles: readonly string[] = rule.roles;
    return [...new Set(actor.memberships.filter((m) => roles.includes(m.role)).map((m) => m.propertyId))];
  }

  /** Prisma `where` fragment on a model with a `propertyId` column. */
  propertyScope(actor: Actor, action: Action): { propertyId?: { in: string[] } } {
    const ids = this.propertyIds(actor, action);
    return ids === 'all' ? {} : { propertyId: { in: ids } };
  }
}
