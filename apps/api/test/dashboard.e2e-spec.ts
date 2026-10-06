import { createTestApp, type TestApp } from './support/app.js';
import { resetDb } from './support/db.js';
import { seedWorld, type World } from './support/world.js';

/**
 * Fixture recap: each property has a Nov 10→13 stay (gross $510.00, cleaning fee $90.00) and a $41.99 owner-borne
 * expense with a receipt. A is on TruPlan (22%) since 2026-01; B has no plan. The clock defaults to
 * 2026-11-20 (Vancouver).
 */
describe('admin dashboard', () => {
  let t: TestApp;
  let w: World;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(async () => {
    t.clock.reset();
    await resetDb(t.prisma);
    w = await seedWorld(t.prisma);
    // Keep the fixture invite fresh relative to the fixed clock unless a test says otherwise.
    await t.prisma.invite.update({
      where: { id: w.pendingInviteId },
      data: { createdAt: new Date('2026-11-19T00:00:00Z') },
    });
  });

  const dash = (query: string) => t.as('admin').get(`/v1/dashboard?${query}`).expect(200);
  const book = (body: object, propertyId = w.propertyA.id) =>
    t
      .as('admin')
      .post(`/v1/properties/${propertyId}/bookings`, { channel: 'AIRBNB', ...body })
      .expect(201);

  it('shows the current month as month to date, without a comparison', async () => {
    const { body } = await dash('month=2026-11');
    expect(body).toMatchObject({
      month: '2026-11',
      today: '2026-11-20',
      period: 'MONTH_TO_DATE',
      scope: { propertyId: null, propertyCount: 2 },
      comparison: null,
      noComparisonReason: 'MONTH_NOT_ENDED',
      kpis: {
        grossCents: 102_000,
        stays: 2,
        incompleteBookings: 0,
        managementFeeCents: 11_220,
        feeRatesBps: [2200],
        nightsBooked: 6,
        availableNights: 60,
        occupancyBps: 1000,
        avgNightlyEarningsCents: 17_000,
      },
      breakdown: {
        grossCents: 102_000,
        managementFeeCents: 11_220,
        ownerExpensesCents: 8_398,
        netToOwnersCents: 82_382,
        cleaningFeesCents: 18_000,
      },
    });
    expect(body.properties.map((p: { name: string; hasPlan: boolean }) => [p.name, p.hasPlan])).toEqual([
      ['Property A', true],
      ['Property B', false],
    ]);
  });

  it('compares a complete month with a complete, planned, fully entered previous month', async () => {
    t.clock.set('2026-12-15T20:00:00Z');
    await book({
      checkInDate: '2026-10-01',
      checkOutDate: '2026-10-04',
      payoutCents: 30_000,
      guestCleaningFeeCents: 0,
    });
    const { body } = await dash(`month=2026-11&propertyId=${w.propertyA.id}`);
    expect(body.period).toBe('COMPLETE');
    expect(body.noComparisonReason).toBeNull();
    expect(body.comparison).toEqual({
      month: '2026-10',
      grossCents: { previous: 30_000, changeBps: 7_000 }, // 51000 vs 30000: +70%
      managementFeeCents: { previous: 6_600, changeBps: 7_000 },
      nightsBooked: { previous: 3, changeBps: 0 },
      occupancyBps: { previous: 968, changeBps: 32 }, // 10.00% vs 9.68%: +0.32 points
      avgNightlyEarningsCents: { previous: 10_000, changeBps: 7_000 },
    });
  });

  it('withholds the comparison when a property had no plan in the previous month', async () => {
    t.clock.set('2026-12-15T20:00:00Z');
    expect((await dash('month=2026-11')).body).toMatchObject({
      comparison: null,
      noComparisonReason: 'NO_PLAN_IN_PREVIOUS_MONTH',
    });
  });

  it('withholds the comparison when the previous month has stays waiting on a payout', async () => {
    t.clock.set('2026-12-15T20:00:00Z');
    await book({ checkInDate: '2026-10-05', checkOutDate: '2026-10-07' });
    expect((await dash(`month=2026-11&propertyId=${w.propertyA.id}`)).body).toMatchObject({
      comparison: null,
      noComparisonReason: 'PREVIOUS_MONTH_INCOMPLETE',
    });
  });

  it('treats future months as upcoming', async () => {
    expect((await dash('month=2027-01')).body).toMatchObject({
      period: 'UPCOMING',
      noComparisonReason: 'MONTH_NOT_ENDED',
    });
  });

  it('lists what needs attention: missing payouts and receipts, missing plans, stale invites', async () => {
    const stay = (await book({ checkInDate: '2026-11-15', checkOutDate: '2026-11-17' })).body;
    // Not yet due: checks in after today.
    await book({ checkInDate: '2026-11-25', checkOutDate: '2026-11-27' });
    const expense = (
      await t
        .as('admin')
        .post(`/v1/properties/${w.propertyA.id}/expenses`, {
          category: 'SUPPLIES',
          incurredOn: '2026-11-18',
          description: 'Coffee pods',
          amountCents: 2_499,
        })
        .expect(201)
    ).body;
    await t.prisma.invite.update({
      where: { id: w.pendingInviteId },
      data: { createdAt: new Date('2026-11-01T00:00:00Z') },
    });

    const { body } = await dash('month=2026-11');
    expect(body.attention.total).toBe(4);
    expect(body.attention.items.map((i: { kind: string; id: string }) => [i.kind, i.id])).toEqual([
      ['PAYOUT_MISSING', stay.id],
      ['RECEIPT_MISSING', expense.id],
      ['NO_PLAN', w.propertyB.id],
      ['INVITE_PENDING', w.pendingInviteId],
    ]);
    expect(body.attention.items[1].detail).toContain('$24.99');

    // Scoped to B: only B's missing plan; the invite is for a cleaner of A.
    const scoped = await dash(`month=2026-11&propertyId=${w.propertyB.id}`);
    expect(scoped.body.attention.items.map((i: { kind: string }) => i.kind)).toEqual(['NO_PLAN']);
  });

  it('lists the next 14 days of check-ins and check-outs, check-outs first on the same day', async () => {
    await book({ checkInDate: '2026-11-21', checkOutDate: '2026-11-24' });
    await book({ checkInDate: '2026-11-24', checkOutDate: '2026-11-26' });
    await book({ checkInDate: '2026-11-30', checkOutDate: '2026-12-06' }); // checkout after the window
    await book({ kind: 'OWNER_STAY', checkInDate: '2026-11-20', checkOutDate: '2026-11-22' }, w.propertyB.id);
    await book({ kind: 'BLOCK', checkInDate: '2026-11-27', checkOutDate: '2026-11-29' }, w.propertyB.id);
    await book({ checkInDate: '2026-12-04', checkOutDate: '2026-12-05' }, w.propertyB.id); // starts on the window's end

    const { body } = await dash('month=2026-11');
    expect(
      body.upcoming.items.map(
        (e: { date: string; type: string; propertyName: string }) => `${e.date} ${e.type} ${e.propertyName}`,
      ),
    ).toEqual([
      '2026-11-20 CHECK_IN Property B',
      '2026-11-21 CHECK_IN Property A',
      '2026-11-22 CHECK_OUT Property B',
      '2026-11-24 CHECK_OUT Property A',
      '2026-11-24 CHECK_IN Property A',
      '2026-11-26 CHECK_OUT Property A',
      '2026-11-30 CHECK_IN Property A',
    ]);
    expect(body.upcoming.total).toBe(7);
  });

  it('caps coming up at 8 items but reports the total', async () => {
    for (let d = 21; d <= 29; d += 2) {
      await book({ checkInDate: `2026-11-${d}`, checkOutDate: `2026-11-${d + 1}` });
    }
    const { body } = await dash('month=2026-11');
    expect(body.upcoming.total).toBe(10);
    expect(body.upcoming.items).toHaveLength(8);
  });

  it('scopes to one property, including an archived one, and 404s an unknown one', async () => {
    await t.as('admin').post(`/v1/properties/${w.propertyB.id}/archive`).expect(200);
    expect((await dash('month=2026-11')).body.scope.propertyCount).toBe(1);
    const archived = await dash(`month=2026-11&propertyId=${w.propertyB.id}`);
    expect(archived.body.properties).toMatchObject([{ id: w.propertyB.id, archived: true }]);
    await t.as('admin').get('/v1/dashboard?month=2026-11&propertyId=00000000-0000-7000-8000-000000000000').expect(404);
  });

  it('has empty, zero-filled sections with no properties', async () => {
    await resetDb(t.prisma);
    await t.prisma.user.create({
      data: {
        email: 'solo@example.test',
        firstName: 'Solo',
        lastName: 'Admin',
        staffRole: 'ADMIN',
        status: 'ACTIVE',
        clerkUserId: 'solo',
      },
    });
    const { body } = await t.as('solo').get('/v1/dashboard?month=2026-11').expect(200);
    expect(body).toMatchObject({
      scope: { propertyCount: 0 },
      kpis: { grossCents: 0, nightsBooked: 0, occupancyBps: null, avgNightlyEarningsCents: null },
      noComparisonReason: 'NO_PROPERTIES',
      properties: [],
      attention: { total: 0, items: [] },
      upcoming: { total: 0, items: [] },
    });
  });
});
