import { createTestApp, type TestApp } from './support/app.js';
import { resetDb } from './support/db.js';
import { seedWorld, type World } from './support/world.js';

describe('bookings', () => {
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

  const create = (body: object, propertyId = w.propertyA.id) =>
    t.as('admin').post(`/v1/properties/${propertyId}/bookings`, { channel: 'AIRBNB', ...body });

  describe('create', () => {
    it('creates a manual guest stay, computes owner gross and nights, and audits it', async () => {
      const res = await create({
        checkInDate: '2026-12-01',
        checkOutDate: '2026-12-04',
        payoutCents: 48_000,
        guestCleaningFeeCents: 8_500,
        guestName: 'A Guest',
      }).expect(201);
      expect(res.body).toMatchObject({
        source: 'MANUAL',
        kind: 'GUEST',
        status: 'CONFIRMED',
        nights: 3,
        ownerGrossCents: 39_500,
        complete: true,
        version: 0,
      });
      const audit = await t.prisma.auditLog.findFirstOrThrow({
        where: { action: 'booking.create', entityId: res.body.id },
      });
      expect(audit.after).toMatchObject({ payoutCents: 48_000, checkInDate: '2026-12-01' });
    });

    it('accepts a guest stay before the payout arrives, marked incomplete', async () => {
      const res = await create({ checkInDate: '2026-12-01', checkOutDate: '2026-12-03' }).expect(201);
      expect(res.body).toMatchObject({ complete: false, ownerGrossCents: null });
    });

    it('allows same-day turnover', async () => {
      await create({ checkInDate: '2026-11-13', checkOutDate: '2026-11-15' }).expect(201);
      await create({ checkInDate: '2026-11-07', checkOutDate: '2026-11-10' }).expect(201);
    });

    it.each([
      ['inside', '2026-11-11', '2026-11-12'],
      ['overlapping the start', '2026-11-08', '2026-11-11'],
      ['overlapping the end', '2026-11-12', '2026-11-14'],
      ['covering', '2026-11-01', '2026-11-30'],
    ])('rejects a stay %s an existing one, naming it', async (_, checkInDate, checkOutDate) => {
      const res = await create({ checkInDate, checkOutDate }).expect(409);
      expect(res.body).toMatchObject({ code: 'BOOKING_OVERLAP', conflictingBookingId: w.bookings.a });
    });

    it('treats owner stays and blocks as occupying the property', async () => {
      await create({ kind: 'BLOCK', checkInDate: '2026-12-01', checkOutDate: '2026-12-05' }).expect(201);
      expect((await create({ checkInDate: '2026-12-04', checkOutDate: '2026-12-06' }).expect(409)).body.code).toBe(
        'BOOKING_OVERLAP',
      );
    });

    it('only checks overlaps within the same property', async () => {
      await create({ checkInDate: '2026-11-10', checkOutDate: '2026-11-13' }, w.propertyB.id).expect(409);
      await create({ checkInDate: '2026-11-13', checkOutDate: '2026-11-14' }, w.propertyB.id).expect(201);
    });

    it('lets exactly one of two simultaneous bookings for the same dates through', async () => {
      const body = { checkInDate: '2026-12-10', checkOutDate: '2026-12-12' };
      const results = await Promise.all([create(body), create(body), create(body)]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    });

    it.each([
      [{ checkInDate: '2026-12-04', checkOutDate: '2026-12-04' }, 'checkOutDate'],
      [{ checkInDate: '2026-12-01', checkOutDate: '2026-12-04', kind: 'OWNER_STAY', payoutCents: 1 }, 'payoutCents'],
      [
        { checkInDate: '2026-12-01', checkOutDate: '2026-12-04', payoutCents: 5_000, guestCleaningFeeCents: 6_000 },
        'guestCleaningFeeCents',
      ],
      [{ checkInDate: '2026-12-01', checkOutDate: '2026-12-04', payoutCents: 499.99 }, 'payoutCents'],
    ])('rejects invalid input %j', async (body, path) => {
      const res = await create(body).expect(400);
      expect(res.body.errors.map((e: { path: string }) => e.path)).toContain(path);
    });

    it('rejects tax amounts while tax fields are disabled', async () => {
      const res = await create({
        checkInDate: '2026-12-01',
        checkOutDate: '2026-12-03',
        taxesCollectedCents: 100,
      }).expect(400);
      expect(res.body.errors[0]).toMatchObject({ path: 'taxesCollectedCents' });
    });
  });

  describe('reading', () => {
    it('shows owners their gross but not guest details, payout or notes', async () => {
      await t.as('admin').patch(`/v1/bookings/${w.bookings.a}`, { version: 0, notes: 'Late arrival' }).expect(200);
      const owner = (await t.as('ownerA').get(`/v1/bookings/${w.bookings.a}`).expect(200)).body;
      expect(owner).toMatchObject({ ownerGrossCents: 51_000, nights: 3, complete: true });
      for (const hidden of [
        'guestName',
        'guestCount',
        'payoutCents',
        'guestCleaningFeeCents',
        'notes',
        'externalId',
        'version',
      ]) {
        expect(owner).not.toHaveProperty(hidden);
      }
      const admin = (await t.as('admin').get(`/v1/bookings/${w.bookings.a}`).expect(200)).body;
      expect(admin).toMatchObject({ guestName: 'Guest Person', payoutCents: 60_000, notes: 'Late arrival' });
    });

    it('lists bookings overlapping the range, including stays that cross its edges', async () => {
      const get = (from: string, to: string) =>
        t.as('admin').get(`/v1/properties/${w.propertyA.id}/bookings?from=${from}&to=${to}`).expect(200);
      expect((await get('2026-11-12', '2026-11-13')).body.items).toHaveLength(1);
      expect((await get('2026-11-13', '2026-11-20')).body.items).toHaveLength(0);
      expect((await get('2026-11-01', '2026-11-10')).body.items).toHaveLength(0);
    });

    it('lists across properties for admins, optionally filtered', async () => {
      const all = await t.as('admin').get('/v1/bookings?from=2026-11-01&to=2026-12-01').expect(200);
      expect(all.body.items).toHaveLength(2);
      const one = await t
        .as('admin')
        .get(`/v1/bookings?from=2026-11-01&to=2026-12-01&propertyId=${w.propertyB.id}`)
        .expect(200);
      expect(one.body.items.map((b: { id: string }) => b.id)).toEqual([w.bookings.b]);
    });

    it('rejects unbounded or reversed ranges', async () => {
      await t.as('admin').get('/v1/bookings?from=2026-01-01&to=2028-01-01').expect(400);
      await t.as('admin').get('/v1/bookings?from=2026-02-01&to=2026-01-01').expect(400);
      await t.as('admin').get('/v1/bookings').expect(400);
    });
  });

  describe('update', () => {
    const patch = (body: object) => t.as('admin').patch(`/v1/bookings/${w.bookings.a}`, body);

    it('updates, bumps the version and audits only what changed', async () => {
      const res = await patch({ version: 0, payoutCents: 61_000 }).expect(200);
      expect(res.body).toMatchObject({ version: 1, ownerGrossCents: 52_000 });
      const audit = await t.prisma.auditLog.findFirstOrThrow({ where: { action: 'booking.update' } });
      expect(audit.before).toEqual({ payoutCents: 60_000 });
      expect(audit.after).toEqual({ payoutCents: 61_000 });
    });

    it('refuses a stale version', async () => {
      await patch({ version: 0, guestCount: 2 }).expect(200);
      expect((await patch({ version: 0, guestCount: 3 }).expect(409)).body.code).toBe('STALE_VERSION');
    });

    it('validates the merged record', async () => {
      const res = await patch({ version: 0, guestCleaningFeeCents: 70_000 }).expect(400);
      expect(res.body.errors[0].path).toBe('guestCleaningFeeCents');
      await patch({ version: 0, checkOutDate: '2026-11-10' }).expect(400);
      await patch({ version: 0, kind: 'BLOCK' }).expect(400);
    });

    it('checks overlaps when dates move, ignoring the booking itself', async () => {
      await create({ checkInDate: '2026-11-20', checkOutDate: '2026-11-22' }).expect(201);
      await patch({ version: 0, checkOutDate: '2026-11-14' }).expect(200);
      expect((await patch({ version: 1, checkOutDate: '2026-11-21' }).expect(409)).body.code).toBe('BOOKING_OVERLAP');
    });
  });

  describe('cancel', () => {
    it('cancels, frees the dates, and keeps a payout that still arrives', async () => {
      const res = await t
        .as('admin')
        .post(`/v1/bookings/${w.bookings.a}/cancel`, { version: 0, note: 'Guest cancelled' })
        .expect(200);
      expect(res.body).toMatchObject({ status: 'CANCELLED', cancellationNote: 'Guest cancelled', version: 1 });
      expect(res.body.cancelledAt).toBeTruthy();

      await create({ checkInDate: '2026-11-10', checkOutDate: '2026-11-13' }).expect(201);

      // Partial refund policy: admin records what was actually paid out.
      const paid = await t
        .as('admin')
        .patch(`/v1/bookings/${w.bookings.a}`, { version: 1, payoutCents: 20_000 })
        .expect(200);
      expect(paid.body).toMatchObject({ status: 'CANCELLED', ownerGrossCents: 11_000 });
    });

    it('refuses to cancel twice', async () => {
      await t.as('admin').post(`/v1/bookings/${w.bookings.a}/cancel`, { version: 0 }).expect(200);
      expect(
        (await t.as('admin').post(`/v1/bookings/${w.bookings.a}/cancel`, { version: 1 }).expect(409)).body.code,
      ).toBe('BOOKING_ALREADY_CANCELLED');
    });
  });

  describe('database guarantees', () => {
    const insert = (over: Record<string, unknown>) =>
      t.prisma.booking.create({
        data: {
          propertyId: w.propertyA.id,
          source: 'MANUAL',
          channel: 'AIRBNB',
          checkInDate: new Date('2026-12-01T00:00:00Z'),
          checkOutDate: new Date('2026-12-03T00:00:00Z'),
          ...over,
        },
      });

    it('rejects overlapping confirmed bookings even without the service', async () => {
      await expect(insert({ checkInDate: new Date('2026-11-12T00:00:00Z') })).rejects.toThrow(/booking_no_overlap/);
    });

    it('allows overlap with a cancelled booking', async () => {
      await expect(
        insert({
          checkInDate: new Date('2026-11-11T00:00:00Z'),
          checkOutDate: new Date('2026-11-12T00:00:00Z'),
          status: 'CANCELLED',
          cancelledAt: new Date(),
        }),
      ).resolves.toBeTruthy();
    });

    it.each([
      [{ checkOutDate: new Date('2026-12-01T00:00:00Z') }, /booking_dates_order/],
      [{ payoutCents: 100, guestCleaningFeeCents: 101 }, /booking_fee_within_payout/],
      [{ kind: 'BLOCK', payoutCents: 100 }, /booking_money_guest_only/],
      [{ payoutCents: -1 }, /booking_money_nonnegative/],
      [{ status: 'CANCELLED' }, /booking_cancel_consistent/],
    ])('enforces %j', async (over, constraint) => {
      await expect(insert(over)).rejects.toThrow(constraint);
    });
  });
});
