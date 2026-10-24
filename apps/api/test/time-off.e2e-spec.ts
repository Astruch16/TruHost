import { createTestApp, type TestApp } from './support/app.js';
import { resetDb } from './support/db.js';
import { seedWorld, type World } from './support/world.js';

describe('cleaner time off', () => {
  let t: TestApp;
  let w: World;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(async () => {
    await resetDb(t.prisma);
    t.clock.reset(); // 2026-11-20, 12:00 in Vancouver
    t.email.reset();
    w = await seedWorld(t.prisma);
  });

  const ask = (who: string, body: object) =>
    t.as(who).post('/v1/time-off', { startDate: '2026-12-01', endDate: '2026-12-05', reason: 'HOLIDAY', ...body });

  describe('asking', () => {
    it('takes a cleaner’s request, tells the admins only, and lists the cleans it falls on', async () => {
      // A turnover of cleanerA's falls in the dates asked for.
      const stay = (
        await t
          .as('admin')
          .post(`/v1/properties/${w.propertyA.id}/bookings`, {
            channel: 'VRBO',
            checkInDate: '2026-11-28',
            checkOutDate: '2026-12-02',
            payoutCents: 80_000,
            guestCleaningFeeCents: 10_000,
          })
          .expect(201)
      ).body;
      await t.prisma.property.update({
        where: { id: w.propertyA.id },
        data: { defaultCleanerId: w.users.cleanerA.id },
      });
      await t.prisma.clean.updateMany({
        where: { bookingId: stay.id },
        data: { assignedCleanerId: w.users.cleanerA.id },
      });
      t.email.reset();

      const req = (await ask('cleanerA', { note: '  Family trip  ' }).expect(201)).body;
      expect(req).toMatchObject({
        cleaner: { id: w.users.cleanerA.id },
        startDate: '2026-12-01',
        endDate: '2026-12-05',
        days: 5,
        reason: 'HOLIDAY',
        note: 'Family trip',
        status: 'PENDING',
        decidedBy: null,
        can: { cancel: true, decide: false },
      });
      expect(req.conflicts).toEqual([
        { cleanId: expect.any(String), date: '2026-12-02', property: { id: w.propertyA.id, name: 'Property A' } },
      ]);

      // The admins hear of it, in the app and by email; no owner does, nor the cleaner.
      const told = await t.prisma.notification.findMany({ where: { kind: 'TIME_OFF_REQUESTED' } });
      expect(told.map((n) => n.userId)).toEqual([w.users.admin.id]);
      expect(told[0]).toMatchObject({
        propertyId: null,
        entityType: 'TimeOffRequest',
        entityId: req.id,
        title: 'cleanerA Test asked for time off',
        body: 'Tue, Dec 1 – Sat, Dec 5 · 5 days · Holiday',
      });
      expect(t.email.sent.map((m) => m.to)).toEqual(['admin@example.test']);
      expect(t.email.sent[0]!.subject).toBe('cleanerA Test asked for time off: Tue, Dec 1 – Sat, Dec 5');
      expect(t.email.sent[0]!.text).toContain('“Family trip”');
      const admin = (await t.as('admin').get('/v1/me/notifications').expect(200)).body.items;
      expect(admin[0]).toMatchObject({ kind: 'TIME_OFF_REQUESTED', property: null });
      expect((await t.as('ownerA').get('/v1/me/notifications').expect(200)).body.items).toEqual([]);
    });

    it('refuses the past, more than 90 days, overlapping its own, and anyone who doesn’t clean', async () => {
      expect((await ask('cleanerA', { startDate: '2026-11-19' }).expect(422)).body.code).toBe('TIME_OFF_IN_PAST');
      await ask('cleanerA', { startDate: '2026-11-20', endDate: '2026-11-20' }).expect(201); // today is fine
      expect((await ask('cleanerA', { endDate: '2026-11-30' }).expect(400)).status).toBe(400); // ends before it starts
      const tooLong = await ask('cleanerA', { startDate: '2027-01-01', endDate: '2027-04-01' }).expect(422);
      expect(tooLong.body.code).toBe('TIME_OFF_TOO_LONG');
      await ask('cleanerA', { startDate: '2027-01-01', endDate: '2027-03-31' }).expect(201); // exactly 90 days
      // Overlapping its own open request (the fixture's Dec 14–18) is refused; another cleaner's days don't clash.
      expect((await ask('cleanerA', { startDate: '2026-12-18', endDate: '2026-12-20' }).expect(422)).body.code).toBe(
        'TIME_OFF_OVERLAPS',
      );
      await ask('cleanerB', {}).expect(201);
      await ask('ownerA', {}).expect(404);
      await ask('admin', {}).expect(404);
    });
  });

  describe('reading, deciding and cancelling', () => {
    it('shows a cleaner only their own, and admins everyone’s, by status and date', async () => {
      await ask('cleanerB', {}).expect(201);
      const mine = (await t.as('cleanerA').get('/v1/time-off').expect(200)).body.items;
      expect(mine.map((r: { id: string }) => r.id)).toEqual([w.timeOff.pendingA]);
      const all = (await t.as('admin').get('/v1/time-off?status=PENDING').expect(200)).body.items;
      expect(all.map((r: { cleaner: { id: string } }) => r.cleaner.id)).toEqual([
        w.users.cleanerB.id,
        w.users.cleanerA.id,
      ]);
      expect(all[1].can).toEqual({ cancel: false, decide: true });
      expect((await t.as('admin').get('/v1/time-off?from=2026-12-10').expect(200)).body.items).toHaveLength(1);
      await t.as('ownerA').get('/v1/time-off').expect(404);
    });

    it('lets admins approve or decline a pending request once, with a note, and audits it', async () => {
      const id = w.timeOff.pendingA;
      await t.as('cleanerA').post(`/v1/time-off/${id}/decision`, { status: 'APPROVED', note: null }).expect(404);
      const approved = (
        await t.as('admin').post(`/v1/time-off/${id}/decision`, { status: 'APPROVED', note: ' Enjoy! ' }).expect(200)
      ).body;
      expect(approved).toMatchObject({
        status: 'APPROVED',
        decisionNote: 'Enjoy!',
        decidedBy: { id: w.users.admin.id },
        can: { decide: false },
      });
      expect(approved.decidedAt).not.toBeNull();
      expect(
        (await t.as('admin').post(`/v1/time-off/${id}/decision`, { status: 'DECLINED', note: null }).expect(409)).body
          .code,
      ).toBe('TIME_OFF_APPROVED');
      expect(await t.prisma.auditLog.findFirst({ where: { action: 'timeOff.decide', entityId: id } })).toMatchObject({
        actorId: w.users.admin.id,
        after: { status: 'APPROVED', note: 'Enjoy!' },
      });
      // The cleaner sees the decision.
      expect((await t.as('cleanerA').get('/v1/time-off').expect(200)).body.items[0]).toMatchObject({
        status: 'APPROVED',
        decisionNote: 'Enjoy!',
        can: { cancel: true },
      });
    });

    it('lets its cleaner cancel it while pending or approved and not over, freeing the days', async () => {
      const id = w.timeOff.pendingA;
      await t.as('cleanerB').post(`/v1/time-off/${id}/cancel`).expect(404);
      await t.as('admin').post(`/v1/time-off/${id}/cancel`).expect(404);
      const cancelled = (await t.as('cleanerA').post(`/v1/time-off/${id}/cancel`).expect(200)).body;
      expect(cancelled).toMatchObject({ status: 'CANCELLED', can: { cancel: false, decide: false } });
      expect((await t.as('cleanerA').post(`/v1/time-off/${id}/cancel`).expect(409)).body.code).toBe(
        'TIME_OFF_CANCELLED',
      );
      // The same days can be asked for again.
      await ask('cleanerA', { startDate: '2026-12-14', endDate: '2026-12-18' }).expect(201);

      // Approved time off that's over can't be cancelled.
      const past = (await ask('cleanerA', { startDate: '2026-11-21', endDate: '2026-11-22' }).expect(201)).body;
      await t.as('admin').post(`/v1/time-off/${past.id}/decision`, { status: 'APPROVED', note: null }).expect(200);
      t.clock.set('2026-11-24T20:00:00Z');
      expect((await t.as('cleanerA').post(`/v1/time-off/${past.id}/cancel`).expect(422)).body.code).toBe(
        'TIME_OFF_OVER',
      );
    });
  });

  describe('database guarantees', () => {
    const sql = (q: string, ...args: unknown[]) => t.prisma.$executeRawUnsafe(q, ...args);
    const insert = (start: string, end: string, status = 'PENDING') =>
      sql(
        `INSERT INTO "TimeOffRequest" (id, "cleanerId", "startDate", "endDate", reason, status, "updatedAt")
         VALUES (gen_random_uuid(), $1::uuid, $2::date, $3::date, 'OTHER', $4::"TimeOffStatus", now())`,
        w.users.cleanerA.id,
        start,
        end,
        status,
      );

    it('keeps a cleaner’s open requests apart, dates sane, and decisions consistent', async () => {
      await expect(insert('2026-12-16', '2026-12-20')).rejects.toThrow(/time_off_no_overlap/);
      await expect(insert('2026-12-10', '2026-12-09')).rejects.toThrow(/time_off_dates/);
      await expect(insert('2027-01-01', '2027-04-01')).rejects.toThrow(/time_off_dates/);
      await expect(insert('2027-01-01', '2027-01-02', 'APPROVED')).rejects.toThrow(/time_off_decided_when_decided/);
      await expect(insert('2027-01-01', '2027-01-02', 'CANCELLED')).rejects.toThrow(
        /time_off_cancelled_when_cancelled/,
      );
    });

    it('never deletes a request, keeps what was asked for, and only moves its status forward', async () => {
      const id = w.timeOff.pendingA;
      await expect(sql(`DELETE FROM "TimeOffRequest" WHERE id = $1::uuid`, id)).rejects.toThrow(/cannot be deleted/);
      await expect(sql(`UPDATE "TimeOffRequest" SET "endDate" = '2026-12-19' WHERE id = $1::uuid`, id)).rejects.toThrow(
        /fixed once asked for/,
      );
      await sql(
        `UPDATE "TimeOffRequest" SET status = 'DECLINED', "decidedAt" = now(), "decidedById" = $2::uuid WHERE id = $1::uuid`,
        id,
        w.users.admin.id,
      );
      await expect(
        sql(
          `UPDATE "TimeOffRequest" SET status = 'PENDING', "decidedAt" = NULL, "decidedById" = NULL WHERE id = $1::uuid`,
          id,
        ),
      ).rejects.toThrow(/cannot go from DECLINED to PENDING/);
      await expect(
        sql(`UPDATE "TimeOffRequest" SET "decisionNote" = 'changed' WHERE id = $1::uuid`, id),
      ).rejects.toThrow(/decision is fixed/);
    });
  });
});
