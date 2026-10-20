import { toTour, tourRoles } from './onboarding.service.js';

describe('tourRoles', () => {
  const m = (...roles: ('OWNER' | 'CLEANER')[]) => roles.map((role, i) => ({ propertyId: `p${i}`, role }));
  it.each([
    [{ staffRole: 'ADMIN' as const, memberships: m('OWNER') }, ['ADMIN']],
    [{ staffRole: 'ADMIN' as const, memberships: m('CLEANER') }, ['ADMIN', 'CLEANER']],
    [{ staffRole: null, memberships: m('OWNER', 'OWNER') }, ['OWNER']],
    [{ staffRole: null, memberships: m('CLEANER', 'OWNER') }, ['OWNER', 'CLEANER']],
    [{ staffRole: null, memberships: [] }, []],
  ])('%o → %o', (actor, roles) => {
    expect(tourRoles(actor)).toEqual(roles);
  });
});

describe('toTour', () => {
  it.each([
    ['NOT_STARTED', 1, 1, true],
    ['IN_PROGRESS', 1, 1, true],
    ['COMPLETED', 1, 1, false],
    ['SKIPPED', 1, 1, false],
    ['COMPLETED', 1, 2, true], // the tour changed since: offered once more
    ['SKIPPED', 2, 2, false],
  ] as const)('%s at version %i (current %i): offered %s', (status, version, current, offer) => {
    expect(toTour('OWNER', status, null, version, current).offer).toBe(offer);
  });
});
