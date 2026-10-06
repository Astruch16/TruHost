import { createTestApp, type TestApp } from './support/app.js';
import { resetDb } from './support/db.js';
import { seedWorld, type World } from './support/world.js';

/**
 * Figures through the real API. The world fixture already holds, on each property, a Nov 10→13 stay (payout
 * $600.00, cleaning fee $90.00 → gross $510.00) and an owner-borne $41.99 expense with a receipt. Property A is on
 * TruPlan (22%) since 2026-01; property B has no plan.
 */
describe('monthly figures', () => {
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

  const book = (body: object, propertyId = w.propertyA.id) =>
    t
      .as('admin')
      .post(`/v1/properties/${propertyId}/bookings`, { channel: 'AIRBNB', ...body })
      .expect(201);

  it('computes a month from bookings, expenses and the plan in force', async () => {
    // Nov 29 → Dec 3 (4 nights), gross 1000.03 → 25000.75/night: two nights (Nov 29–30) in November.
    await book({
      checkInDate: '2026-11-29',
      checkOutDate: '2026-12-03',
      payoutCents: 120_003,
      guestCleaningFeeCents: 20_000,
    });
    // An incomplete stay: counted as nights, not money.
    await book({ checkInDate: '2026-11-20', checkOutDate: '2026-11-22' });

    const res = await t.as('admin').get(`/v1/properties/${w.propertyA.id}/summary?month=2026-11`).expect(200);
    // Allocation of 100003 over 4 nights: [25001, 25001, 25001, 25000] → November gets 50002.
    expect(res.body).toEqual({
      propertyId: w.propertyA.id,
      month: '2026-11',
      daysInMonth: 30,
      nightsBooked: 7, // 3 (fixture) + 2 (incomplete) + 2 (crossing)
      ownerStayNights: 0,
      blockNights: 0,
      availableNights: 30,
      occupancyBps: 2333,
      stays: 3,
      grossCents: 101_002, // 51000 + 50002
      plan: { id: w.planId, name: 'TruPlan' },
      managementFeeBps: 2200,
      managementFeeCents: 22_220, // 22220.44 → 22220
      ownerExpensesCents: 4_199,
      netCents: 74_583,
      avgNightlyEarningsCents: 20_200, // 101002 / 5 complete nights = 20200.4
      incompleteBookings: 1,
      expensesMissingReceipt: 0,
      cleaningFeesCents: 9_000, // only the fixture stay checks out in November
    });

    const december = await t.as('admin').get(`/v1/properties/${w.propertyA.id}/summary?month=2026-12`).expect(200);
    expect(december.body).toMatchObject({ nightsBooked: 2, grossCents: 50_001, cleaningFeesCents: 20_000 });
  });

  it('hides TruHost revenue from owners', async () => {
    const owner = await t.as('ownerA').get(`/v1/properties/${w.propertyA.id}/summary?month=2026-11`).expect(200);
    expect(owner.body).toMatchObject({ grossCents: 51_000, managementFeeCents: 11_220, netCents: 35_581 });
    expect(owner.body).not.toHaveProperty('cleaningFeesCents');
  });

  it('charges no fee without a plan, and stops counting voided expenses', async () => {
    await t.as('admin').post(`/v1/expenses/${w.expenses.b}/void`, { reason: 'Duplicate' }).expect(200);
    const res = await t.as('admin').get(`/v1/properties/${w.propertyB.id}/summary?month=2026-11`).expect(200);
    expect(res.body).toMatchObject({
      plan: null,
      managementFeeBps: null,
      managementFeeCents: 0,
      ownerExpensesCents: 0,
      netCents: 51_000,
    });
  });

  it('returns a full year of months', async () => {
    const res = await t.as('ownerA').get(`/v1/properties/${w.propertyA.id}/summary/monthly?year=2026`).expect(200);
    expect(res.body.items.map((m: { month: string }) => m.month)).toEqual(
      Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`),
    );
    expect(res.body.items[10]).toMatchObject({ month: '2026-11', grossCents: 51_000 });
    expect(res.body.items[9]).toMatchObject({ month: '2026-10', grossCents: 0, avgNightlyEarningsCents: null });
  });

  it('totals the portfolio with fees rounded per property', async () => {
    const res = await t.as('admin').get('/v1/reports/portfolio?month=2026-11').expect(200);
    expect(res.body.totals).toMatchObject({
      properties: 2,
      nightsBooked: 6,
      availableNights: 60,
      occupancyBps: 1000,
      grossCents: 102_000,
      managementFeeCents: 11_220, // A only; B has no plan
      ownerExpensesCents: 8_398,
      netCents: 82_382,
      avgNightlyEarningsCents: 17_000,
      cleaningFeesCents: 18_000,
    });
    expect(res.body.properties.map((p: { name: string }) => p.name)).toEqual(['Property A', 'Property B']);
  });

  it('validates the month', async () => {
    await t.as('admin').get(`/v1/properties/${w.propertyA.id}/summary?month=2026-13`).expect(400);
    await t.as('admin').get(`/v1/properties/${w.propertyA.id}/summary`).expect(400);
  });
});
