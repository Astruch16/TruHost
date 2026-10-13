import { OWN_PROPERTY_PLAN_ID } from '@truhost/shared';
import { createTestApp, type TestApp } from './support/app.js';
import { resetDb } from './support/db.js';
import { seedWorld, type World } from './support/world.js';

describe('plans', () => {
  let t: TestApp;
  let w: World;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(async () => {
    await resetDb(t.prisma);
    w = await seedWorld(t.prisma);
  });

  it('locks the rate of a plan in use (API)', async () => {
    const res = await t.as('admin').patch(`/v1/plans/${w.planId}`, { managementFeeBps: 2500 }).expect(409);
    expect(res.body.code).toBe('PLAN_RATE_LOCKED');
    await t.as('admin').patch(`/v1/plans/${w.planId}`, { description: 'ok' }).expect(200);
  });

  it('locks the rate of a plan in use (database trigger)', async () => {
    await expect(
      t.prisma.$executeRaw`UPDATE "Plan" SET "managementFeeBps" = 2500 WHERE id = ${w.planId}::uuid`,
    ).rejects.toThrow(/immutable/);
  });

  it('allows changing the rate of an unused plan', async () => {
    const plan = await t.as('admin').post('/v1/plans', { name: 'Draft', managementFeeBps: 2000 }).expect(201);
    expect(plan.body.inUse).toBe(false);
    await t.as('admin').patch(`/v1/plans/${plan.body.id}`, { managementFeeBps: 1800 }).expect(200);
  });

  it('assigns a new plan from a month, closing the open period', async () => {
    const other = await t.as('admin').post('/v1/plans', { name: 'Other', managementFeeBps: 2000 }).expect(201);
    const res = await t
      .as('admin')
      .post(`/v1/properties/${w.propertyA.id}/plan`, { planId: other.body.id, effectiveFrom: '2026-11-01' })
      .expect(200);
    expect(res.body.current).toMatchObject({ plan: { name: 'Other' }, effectiveFrom: '2026-11-01', effectiveTo: null });
    expect(res.body.history[1]).toMatchObject({
      plan: { name: 'TruPlan' },
      effectiveFrom: '2026-01-01',
      effectiveTo: '2026-11-01',
    });

    const owner = await t.as('ownerA').get(`/v1/properties/${w.propertyA.id}/plan`).expect(200);
    expect(owner.body.current.plan.managementFeeBps).toBe(2000);
  });

  it('only starts plans on the first of a month, after the latest period', async () => {
    await t
      .as('admin')
      .post(`/v1/properties/${w.propertyA.id}/plan`, { planId: w.planId, effectiveFrom: '2026-11-15' })
      .expect(400);
    const res = await t
      .as('admin')
      .post(`/v1/properties/${w.propertyA.id}/plan`, { planId: w.planId, effectiveFrom: '2025-12-01' })
      .expect(409);
    expect(res.body.code).toBe('PLAN_PERIOD_CONFLICT');
  });

  describe('own property (no fee)', () => {
    it('corrects every month so far to the 0% plan, keeping the dates, and the fee goes', async () => {
      const other = await t.as('admin').post('/v1/plans', { name: 'Other', managementFeeBps: 2000 }).expect(201);
      await t
        .as('admin')
        .post(`/v1/properties/${w.propertyA.id}/plan`, { planId: other.body.id, effectiveFrom: '2026-11-01' })
        .expect(200);
      const before = await t.as('admin').get(`/v1/properties/${w.propertyA.id}/summary?month=2026-11`).expect(200);
      expect(before.body.managementFeeCents).toBeGreaterThan(0);

      const res = await t
        .as('admin')
        .post(`/v1/properties/${w.propertyA.id}/plan/correct`, { planId: OWN_PROPERTY_PLAN_ID })
        .expect(200);
      expect(
        res.body.history.map((p: { plan: { name: string }; effectiveFrom: string }) => [p.plan.name, p.effectiveFrom]),
      ).toEqual([
        ['Own property', '2026-11-01'],
        ['Own property', '2026-01-01'],
      ]);
      for (const month of ['2026-10', '2026-11']) {
        const summary = await t.as('ownerA').get(`/v1/properties/${w.propertyA.id}/summary?month=${month}`).expect(200);
        expect(summary.body).toMatchObject({ managementFeeBps: 0, managementFeeCents: 0 });
      }
      const audit = await t.prisma.auditLog.findFirstOrThrow({ where: { action: 'propertyPlan.correct' } });
      expect(audit).toMatchObject({ actorId: w.users.admin.id, propertyId: w.propertyA.id });
      expect(audit.before).toEqual({
        periods: [
          { planId: w.planId, effectiveFrom: '2026-01-01' },
          { planId: other.body.id, effectiveFrom: '2026-11-01' },
        ],
      });
    });

    it('starts the plan in the month the property was added when it had none', async () => {
      const p = await t
        .as('admin')
        .post('/v1/properties', { name: 'Bare', addressLine1: '1 X St', city: 'Vancouver', postalCode: 'V6K3G1' })
        .expect(201);
      const res = await t
        .as('admin')
        .post(`/v1/properties/${p.body.id}/plan/correct`, { planId: OWN_PROPERTY_PLAN_ID })
        .expect(200);
      expect(res.body.current).toMatchObject({
        plan: { name: 'Own property', managementFeeBps: 0 },
        effectiveTo: null,
      });
      expect(res.body.history).toHaveLength(1);
    });

    it('puts a property an admin adds as their own on it from the start', async () => {
      const p = await t
        .as('admin')
        .post('/v1/properties', {
          name: 'Mine',
          addressLine1: '1 X St',
          city: 'Vancouver',
          postalCode: 'V6K3G1',
          ownedByMe: true,
        })
        .expect(201);
      const plan = await t.as('admin').get(`/v1/properties/${p.body.id}/plan`).expect(200);
      expect(plan.body.current.plan).toMatchObject({ id: OWN_PROPERTY_PLAN_ID, managementFeeBps: 0 });
    });

    it('refuses unknown plans, non-admins, and archiving the Own property plan', async () => {
      await t
        .as('admin')
        .post(`/v1/properties/${w.propertyA.id}/plan/correct`, { planId: '00000000-0000-7000-8000-000000000000' })
        .expect(422);
      await t
        .as('ownerA')
        .post(`/v1/properties/${w.propertyA.id}/plan/correct`, { planId: OWN_PROPERTY_PLAN_ID })
        .expect(404);
      const res = await t.as('admin').post(`/v1/plans/${OWN_PROPERTY_PLAN_ID}/archive`).expect(422);
      expect(res.body.code).toBe('PLAN_RESERVED');
    });
  });
});

describe('database guarantees', () => {
  let t: TestApp;
  let w: World;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(async () => {
    await resetDb(t.prisma);
    w = await seedWorld(t.prisma);
  });

  it('makes the audit log append-only', async () => {
    await t.as('admin').patch(`/v1/properties/${w.propertyA.id}`, { name: 'X' }).expect(200);
    await expect(t.prisma.$executeRaw`UPDATE "AuditLog" SET action = 'tampered'`).rejects.toThrow(/append-only/);
    await expect(t.prisma.$executeRaw`DELETE FROM "AuditLog"`).rejects.toThrow(/append-only/);
  });

  it('rejects overlapping plan periods for a property', async () => {
    await expect(
      t.prisma.propertyPlan.create({
        data: { propertyId: w.propertyA.id, planId: w.planId, effectiveFrom: new Date('2026-06-01T00:00:00Z') },
      }),
    ).rejects.toThrow();
  });

  it('rejects plan periods that do not start on the 1st', async () => {
    await expect(
      t.prisma.propertyPlan.create({
        data: { propertyId: w.propertyB.id, planId: w.planId, effectiveFrom: new Date('2026-06-02T00:00:00Z') },
      }),
    ).rejects.toThrow();
  });

  it('rejects a second active grant but allows one after revocation', async () => {
    await expect(
      t.prisma.membership.create({ data: { userId: w.users.ownerA.id, propertyId: w.propertyA.id, role: 'OWNER' } }),
    ).rejects.toThrow();
    await t.prisma.membership.update({ where: { id: w.memberships.ownerA }, data: { revokedAt: new Date() } });
    await t.prisma.membership.create({
      data: { userId: w.users.ownerA.id, propertyId: w.propertyA.id, role: 'OWNER' },
    });
  });

  it('stores emails lower-cased only', async () => {
    await expect(
      t.prisma.user.create({ data: { email: 'Mixed@Example.test', firstName: 'a', lastName: 'b' } }),
    ).rejects.toThrow();
  });
});
