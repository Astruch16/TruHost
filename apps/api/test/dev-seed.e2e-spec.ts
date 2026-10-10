import { SEED_PROPERTIES, seedTestAccounts, TEST_ACCOUNTS, type SeedIdentity } from '../src/dev-seed/test-accounts.js';
import { createTestApp, type TestApp } from './support/app.js';
import { resetDb } from './support/db.js';
import { seedWorld } from './support/world.js';

/** Stands in for Clerk: the sign-in id is derived from the email, as a stable fake. */
const identity: SeedIdentity = {
  ensureUser: async ({ email }) => (email.includes('+owner') ? 'seed-owner' : 'seed-cleaner'),
};

describe('dev seed: local test accounts', () => {
  let t: TestApp;
  const now = new Date('2026-10-09T18:00:00Z');

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(async () => {
    await resetDb(t.prisma);
    await seedWorld(t.prisma);
  });

  const counts = async () => ({
    users: await t.prisma.user.count(),
    properties: await t.prisma.property.count(),
    memberships: await t.prisma.membership.count(),
    bookings: await t.prisma.booking.count(),
    expenses: await t.prisma.expense.count(),
    plans: await t.prisma.propertyPlan.count(),
  });

  it('signs the owner and cleaner in to their own two properties, with figures for the owner', async () => {
    await seedTestAccounts(t.prisma, identity, now);
    const owner = await t.as('seed-owner').get('/v1/me').expect(200);
    expect(owner.body).toMatchObject({ email: TEST_ACCOUNTS.owner.email, staffRole: null });
    expect(owner.body.memberships.map((m: { role: string }) => m.role)).toEqual(['OWNER', 'OWNER']);

    const cleaner = await t.as('seed-cleaner').get('/v1/properties').expect(200);
    expect(cleaner.body.items.map((p: { id: string }) => p.id).sort()).toEqual(SEED_PROPERTIES.map((p) => p.id).sort());

    const [seaside] = SEED_PROPERTIES;
    const summary = await t.as('seed-owner').get(`/v1/properties/${seaside.id}/summary?month=2026-09`).expect(200);
    expect(summary.body.grossCents).toBeGreaterThan(0);
    expect(summary.body.nightsBooked).toBe(16);
    const property = await t.prisma.property.findUniqueOrThrow({ where: { id: seaside.id } });
    expect(property.defaultCleanerId).toBe(
      (await t.prisma.user.findUniqueOrThrow({ where: { clerkUserId: 'seed-cleaner' } })).id,
    );
  });

  it('is idempotent, and a later run only adds the new month', async () => {
    await seedTestAccounts(t.prisma, identity, now);
    const first = await counts();
    await seedTestAccounts(t.prisma, identity, now);
    expect(await counts()).toEqual(first);

    await seedTestAccounts(t.prisma, identity, new Date('2026-11-09T18:00:00Z'));
    const later = await counts();
    expect(later.bookings - first.bookings).toBe(8); // December: four stays at each property
    expect({ ...later, bookings: 0, expenses: 0 }).toEqual({ ...first, bookings: 0, expenses: 0 });
    // Seven guest stays a month (Cedar's second stay is an owner stay). November's were pending in October's run and
    // stay as entered (the seed never edits a booking), so November and December are both pending.
    expect(
      await t.prisma.booking.count({
        where: { externalId: { startsWith: 'seed-' }, payoutCents: null, kind: 'GUEST' },
      }),
    ).toBe(14);
  });

  it('dates no expense after today', async () => {
    await seedTestAccounts(t.prisma, identity, now);
    const seeded = { propertyId: { in: SEED_PROPERTIES.map((p) => p.id) } };
    expect(
      await t.prisma.expense.count({ where: { ...seeded, incurredOn: { gt: new Date('2026-10-09T00:00:00Z') } } }),
    ).toBe(0);
    expect(await t.prisma.expense.count({ where: seeded })).toBeGreaterThan(0);
  });

  it('needs an admin to record who entered the data', async () => {
    await resetDb(t.prisma);
    await expect(seedTestAccounts(t.prisma, identity, now)).rejects.toThrow(/bootstrap/);
  });
});
