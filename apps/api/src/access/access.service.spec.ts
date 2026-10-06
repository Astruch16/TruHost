import type { Actor } from '../auth/actor.js';
import { ProblemException } from '../common/problem.js';
import { AccessService } from './access.service.js';
import { POLICY } from './policy.js';

const P1 = '00000000-0000-7000-8000-000000000001';
const P2 = '00000000-0000-7000-8000-000000000002';

const actor = (over: Partial<Actor> = {}): Actor => ({ userId: 'u', staffRole: null, memberships: [], ...over });
const admin = actor({ staffRole: 'ADMIN' });
const owner = actor({ memberships: [{ propertyId: P1, role: 'OWNER' }] });
const cleaner = actor({ memberships: [{ propertyId: P1, role: 'CLEANER' }] });
const adminOwner = actor({ staffRole: 'ADMIN', memberships: [{ propertyId: P1, role: 'OWNER' }] });

describe('AccessService', () => {
  const access = new AccessService();

  it('lets admins do every admin-enabled action on any property', () => {
    for (const action of Object.keys(POLICY) as (keyof typeof POLICY)[]) {
      expect(access.can(admin, action, P2)).toBe(POLICY[action].admin);
    }
  });

  it('scopes members to their own properties and roles', () => {
    expect(access.can(owner, 'property:read', P1)).toBe(true);
    expect(access.can(owner, 'property:read', P2)).toBe(false);
    expect(access.can(owner, 'property:readAccessInstructions', P1)).toBe(false);
    expect(access.can(cleaner, 'property:readAccessInstructions', P1)).toBe(true);
    expect(access.can(cleaner, 'propertyPlan:read', P1)).toBe(false);
    expect(access.can(owner, 'propertyPlan:read', P1)).toBe(true);
  });

  it('never grants admin-only actions through memberships', () => {
    for (const [action, rule] of Object.entries(POLICY)) {
      if (rule.roles.length === 0) {
        expect(access.can(owner, action as keyof typeof POLICY, P1)).toBe(false);
        expect(access.can(cleaner, action as keyof typeof POLICY, P1)).toBe(false);
      }
    }
  });

  it('denies global actions to non-admins', () => {
    expect(access.can(owner, 'user:manage')).toBe(false);
    expect(access.can(owner, 'property:read')).toBe(false);
  });

  it('gives an admin who also owns a property nothing beyond admin access', () => {
    expect(access.propertyIds(adminOwner, 'property:read')).toBe('all');
    expect(access.can(adminOwner, 'property:readAccessInstructions', P2)).toBe(true);
  });

  it('builds list scopes', () => {
    expect(access.propertyScope(admin, 'room:read')).toEqual({});
    expect(access.propertyScope(owner, 'room:read')).toEqual({ propertyId: { in: [P1] } });
    expect(access.propertyScope(owner, 'propertyPlan:assign')).toEqual({ propertyId: { in: [] } });
  });

  it('denies with a 404 problem', () => {
    expect(() => access.assert(owner, 'property:read', P2, 'Property')).toThrow(ProblemException);
    try {
      access.assert(owner, 'property:read', P2, 'Property');
    } catch (e) {
      expect((e as ProblemException).problem).toMatchObject({ status: 404, code: 'NOT_FOUND' });
    }
  });
});
