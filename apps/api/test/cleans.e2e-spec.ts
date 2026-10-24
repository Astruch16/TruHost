import { createHash } from 'node:crypto';
import { createTestApp, type TestApp } from './support/app.js';
import { resetDb } from './support/db.js';
import { seedWorld, type World } from './support/world.js';

const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const pathOf = (url: string) => {
  const u = new URL(url);
  return `${u.pathname}${u.search}`;
};

describe('cleans', () => {
  let t: TestApp;
  let w: World;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(async () => {
    await resetDb(t.prisma);
    t.clock.reset(); // 2026-11-20, 12:00 in Vancouver
    w = await seedWorld(t.prisma);
    await t.prisma.property.update({ where: { id: w.propertyA.id }, data: { defaultCleanerId: w.users.cleanerA.id } });
  });

  /** Uploads a clean (or damage) photo, both renditions, as `who`; returns the ids to attach. */
  async function upload(who: string, propertyId = w.propertyA.id, purpose = 'CLEAN_PHOTO') {
    const one = async (body: Buffer) => {
      const target = (
        await t
          .as(who)
          .post('/v1/uploads', {
            purpose,
            propertyId,
            contentType: 'image/jpeg',
            sizeBytes: body.length,
            sha256: sha256(body),
          })
          .expect(201)
      ).body;
      let req = t.http().put(pathOf(target.upload.url));
      for (const [k, v] of Object.entries(target.upload.headers as Record<string, string>)) req = req.set(k, v);
      await req.send(body).expect(200);
      return target.fileId as string;
    };
    const salt = Math.random().toString(36);
    return { fileId: await one(Buffer.from(`large ${salt}`)), thumbFileId: await one(Buffer.from(`thumb ${salt}`)) };
  }

  /** Attaches a fresh clean photo as `who`, expecting `status`; returns the response body. */
  const photo = async (who: string, cleanId: string, roomId: string, phase: 'BEFORE' | 'AFTER', status = 201) =>
    (
      await t
        .as(who)
        .post(`/v1/cleans/${cleanId}/photos`, { roomId, phase, ...(await upload(who)) })
        .expect(status)
    ).body;

  const levels = (pcts: number[] = []) => ({
    readings: w.propertyA.supplyIds.map((supplyItemId, i) => ({ supplyItemId, levelPct: pcts[i] ?? 100 })),
  });

  /** The checklist up to the after photos, as `who`: every before photo, no damage, every supply counted. */
  async function prep(who: string, id: string, pcts: number[] = []) {
    for (const room of w.propertyA.roomIds) await photo(who, id, room, 'BEFORE');
    await t.as(who).post(`/v1/cleans/${id}/damage-check`, { found: false }).expect(200);
    return (await t.as(who).post(`/v1/cleans/${id}/stock-count`, levels(pcts)).expect(200)).body;
  }

  const stay = (body: object = {}) =>
    t.as('admin').post(`/v1/properties/${w.propertyA.id}/bookings`, {
      channel: 'VRBO',
      checkInDate: '2026-12-01',
      checkOutDate: '2026-12-05',
      payoutCents: 80_000,
      guestCleaningFeeCents: 10_000,
      ...body,
    });
  const turnoverOf = (bookingId: string) => t.prisma.clean.findUnique({ where: { bookingId } });

  describe('turnovers follow their stays', () => {
    it('creates one for a guest or owner stay, for the default cleaner at the default pay; none for a block', async () => {
      const guest = (await stay().expect(201)).body;
      expect(await turnoverOf(guest.id)).toMatchObject({
        kind: 'TURNOVER',
        status: 'SCHEDULED',
        scheduledDate: new Date('2026-12-05T00:00:00Z'),
        assignedCleanerId: w.users.cleanerA.id,
        cleanerPayCents: 9000,
      });
      const owner = (
        await stay({
          kind: 'OWNER_STAY',
          checkInDate: '2026-12-10',
          checkOutDate: '2026-12-12',
          payoutCents: null,
          guestCleaningFeeCents: null,
        }).expect(201)
      ).body;
      expect((await turnoverOf(owner.id))?.scheduledDate).toEqual(new Date('2026-12-12T00:00:00Z'));
      const block = (
        await stay({
          kind: 'BLOCK',
          checkInDate: '2026-12-20',
          checkOutDate: '2026-12-22',
          payoutCents: null,
          guestCleaningFeeCents: null,
        }).expect(201)
      ).body;
      expect(await turnoverOf(block.id)).toBeNull();
    });

    it('moves with the stay, is cancelled with it, and leaves a clean under way alone', async () => {
      const b = (await stay().expect(201)).body;
      const moved = (
        await t
          .as('admin')
          .patch(`/v1/bookings/${b.id}`, { version: b.version, checkOutDate: '2026-12-06' })
          .expect(200)
      ).body;
      expect((await turnoverOf(b.id))?.scheduledDate).toEqual(new Date('2026-12-06T00:00:00Z'));
      await t.as('admin').post(`/v1/bookings/${b.id}/cancel`, { version: moved.version, note: null }).expect(200);
      expect(await turnoverOf(b.id)).toMatchObject({ status: 'CANCELLED', cancelReason: 'The stay was cancelled.' });

      // A clean already started stays as it is when its stay moves.
      const other = (await stay({ checkInDate: '2026-12-08', checkOutDate: '2026-12-10' }).expect(201)).body;
      const clean = (await turnoverOf(other.id))!;
      t.clock.set('2026-12-10T19:00:00Z');
      await t.as('cleanerA').post(`/v1/cleans/${clean.id}/start`).expect(200);
      await t.as('admin').patch(`/v1/bookings/${other.id}`, { version: other.version, checkOutDate: '2026-12-11' });
      expect(await turnoverOf(other.id)).toMatchObject({
        status: 'IN_PROGRESS',
        scheduledDate: new Date('2026-12-10T00:00:00Z'),
      });
    });
  });

  describe('reading', () => {
    it('shows owners the property’s cleans without pay, and a cleaner the pay on their own', async () => {
      const owner = (await t.as('ownerA').get('/v1/cleans').expect(200)).body.items;
      expect(owner.map((c: { id: string }) => c.id).sort()).toEqual([w.cleans.a, w.cleans.todayA].sort());
      expect(owner.every((c: { cleanerPayCents: number | null }) => c.cleanerPayCents === null)).toBe(true);
      const mine = (await t.as('cleanerA').get('/v1/cleans?assignee=me').expect(200)).body.items;
      expect(mine.map((c: { cleanerPayCents: number }) => c.cleanerPayCents)).toEqual([9000, 9000]);
      // Another property's cleaner sees none of A's, and can't open one.
      expect(
        (await t.as('cleanerB').get('/v1/cleans').expect(200)).body.items.map((c: { id: string }) => c.id),
      ).toEqual([w.cleans.b]);
      await t.as('cleanerB').get(`/v1/cleans/${w.cleans.a}`).expect(404);
      await t.as('cleanerB').get(`/v1/cleans?propertyId=${w.propertyA.id}`).expect(404);
    });

    it('works out the window from check-out to the next arrival, and the checklist in walkthrough order', async () => {
      // The next arrival after booking A's check-out (Nov 13): a stay from Nov 15 at a 15:00 early check-in.
      await t.prisma.booking.create({
        data: {
          propertyId: w.propertyA.id,
          source: 'MANUAL',
          channel: 'DIRECT',
          checkInDate: new Date('2026-11-15T00:00:00Z'),
          checkOutDate: new Date('2026-11-17T00:00:00Z'),
          checkInTimeOverride: '15:00',
        },
      });
      const c = (await t.as('cleanerA').get(`/v1/cleans/${w.cleans.a}`).expect(200)).body;
      expect(c.window).toEqual({
        from: { date: '2026-11-13', time: '11:00' },
        until: { date: '2026-11-15', time: '15:00' },
      });
      expect(c.stay).toEqual({ kind: 'GUEST', checkInDate: '2026-11-10', checkOutDate: '2026-11-13' });
      expect(c.rooms.map((r: { displayName: string }) => r.displayName)).toEqual(['Bedroom', 'Bathroom']);
      expect(c.progress).toEqual({ rooms: 2, done: 0 });
      expect(c.today).toBe('2026-11-20');
      expect(c.can).toEqual({
        start: false,
        addPhotos: false,
        addAfterPhotos: false,
        checkDamage: false,
        countStock: false,
        complete: false,
      }); // not its day
      expect(c.checklist).toMatchObject({ current: null, stockCount: { items: 2, counted: 0 } });
    });
  });

  describe('starting', () => {
    it('lets the assigned cleaner start only on the scheduled day, in the property’s time zone; admins any day', async () => {
      const notToday = await t.as('cleanerA').post(`/v1/cleans/${w.cleans.a}/start`).expect(422);
      expect(notToday.body).toMatchObject({
        code: 'CLEAN_NOT_TODAY',
        scheduledDate: '2026-11-13',
        today: '2026-11-20',
      });
      // 2026-11-14 06:00 UTC is still the 13th in Vancouver.
      t.clock.set('2026-11-14T06:00:00Z');
      const started = (await t.as('cleanerA').post(`/v1/cleans/${w.cleans.a}/start`).expect(200)).body;
      expect(started).toMatchObject({
        status: 'IN_PROGRESS',
        can: { addPhotos: true, checkDamage: false, complete: false },
        checklist: { current: 'BEFORE_PHOTOS' },
      });
      expect((await t.as('cleanerA').post(`/v1/cleans/${w.cleans.a}/start`).expect(409)).body.code).toBe(
        'CLEAN_IN_PROGRESS',
      );
      t.clock.reset();
      await t.as('admin').post(`/v1/cleans/${w.cleans.b}/start`).expect(200);
    });

    it('needs someone assigned, and is not found for anyone else’s clean', async () => {
      await t.prisma.clean.update({ where: { id: w.cleans.todayA }, data: { assignedCleanerId: null } });
      expect((await t.as('admin').post(`/v1/cleans/${w.cleans.todayA}/start`).expect(422)).body.code).toBe(
        'CLEAN_UNASSIGNED',
      );
      // cleanerA isn't assigned any more: they can read it, but not work it.
      await t.as('cleanerA').get(`/v1/cleans/${w.cleans.todayA}`).expect(200);
      await t.as('cleanerA').post(`/v1/cleans/${w.cleans.todayA}/start`).expect(404);
    });
  });

  describe('photos and completing', () => {
    it('works the checklist in order: before photos, damage, stock count, after photos, then finished', async () => {
      const [bedroom, bathroom] = w.propertyA.roomIds as [string, string];
      const id = w.cleans.todayA;
      await t.as('cleanerA').post(`/v1/cleans/${id}/start`).expect(200);
      const none = await t.as('cleanerA').post(`/v1/cleans/${id}/complete`).expect(422);
      expect(none.body.code).toBe('CLEAN_MISSING_PHOTOS');
      expect(none.body.missing).toEqual([
        { roomId: bedroom, displayName: 'Bedroom', phases: ['BEFORE', 'AFTER'] },
        { roomId: bathroom, displayName: 'Bathroom', phases: ['BEFORE', 'AFTER'] },
      ]);
      const waiting = async (path: string, body: object, waitingOn: string) =>
        expect((await t.as('cleanerA').post(`/v1/cleans/${id}/${path}`, body).expect(422)).body).toMatchObject({
          code: 'CLEAN_CHECKLIST_INCOMPLETE',
          waitingOn,
        });

      // 1. Before photos: nothing after them opens until every room has one.
      await waiting('damage-check', { found: false }, 'BEFORE_PHOTOS');
      await photo('cleanerA', id, bedroom, 'BEFORE');
      expect((await photo('cleanerA', id, bedroom, 'AFTER', 422)).waitingOn).toBe('BEFORE_PHOTOS');
      const before = await photo('cleanerA', id, bathroom, 'BEFORE');
      expect(before.checklist).toMatchObject({ beforePhotos: { done: true }, current: 'DAMAGE' });
      expect(before.can).toMatchObject({ checkDamage: true, countStock: false, addAfterPhotos: false });

      // 2. Damage: the stock count and after photos wait on it.
      await waiting('stock-count', levels(), 'DAMAGE');
      expect((await photo('cleanerA', id, bedroom, 'AFTER', 422)).waitingOn).toBe('DAMAGE');
      const noDamage = (await t.as('cleanerA').post(`/v1/cleans/${id}/damage-check`, { found: false }).expect(200))
        .body;
      expect(noDamage.checklist).toMatchObject({ damage: { found: false, done: true }, current: 'STOCK_COUNT' });

      // 3. Stock count: every item, once; what's at or below its restock point is listed to restock.
      expect((await photo('cleanerA', id, bedroom, 'AFTER', 422)).waitingOn).toBe('STOCK_COUNT');
      const partial = await t
        .as('cleanerA')
        .post(`/v1/cleans/${id}/stock-count`, { readings: [{ supplyItemId: w.propertyA.supplyIds[0], levelPct: 50 }] })
        .expect(422);
      expect(partial.body).toMatchObject({ code: 'STOCK_COUNT_INCOMPLETE', missing: [w.propertyA.supplyIds[1]] });
      const counted = (
        await t
          .as('cleanerA')
          .post(`/v1/cleans/${id}/stock-count`, levels([25, 0]))
          .expect(200)
      ).body;
      expect(counted.checklist.stockCount).toEqual({
        items: 2,
        counted: 2,
        done: true,
        restock: [
          { id: w.propertyA.supplyIds[1], name: 'Coffee pods', levelPct: 0, state: 'OUT' },
          { id: w.propertyA.supplyIds[0], name: 'Toilet paper', levelPct: 25, state: 'LOW' },
        ],
      });
      expect(counted.checklist.current).toBe('AFTER_PHOTOS');
      // Recounting replaces this clean's levels (the latest counts).
      const recounted = (
        await t
          .as('cleanerA')
          .post(`/v1/cleans/${id}/stock-count`, levels([100, 0]))
          .expect(200)
      ).body;
      expect(recounted.checklist.stockCount.restock.map((r: { name: string }) => r.name)).toEqual(['Coffee pods']);

      // 4. After photos, then 5. finished.
      await photo('cleanerA', id, bedroom, 'AFTER');
      expect((await t.as('cleanerA').post(`/v1/cleans/${id}/complete`).expect(422)).body.missing).toEqual([
        { roomId: bathroom, displayName: 'Bathroom', phases: ['AFTER'] },
      ]);
      const ready = await photo('cleanerA', id, bathroom, 'AFTER');
      expect(ready.checklist.current).toBe('FINISH');
      expect(ready.can.complete).toBe(true);
      t.email.reset();
      const done = (await t.as('cleanerA').post(`/v1/cleans/${id}/complete`).expect(200)).body;
      expect(done).toMatchObject({ status: 'COMPLETE', progress: { rooms: 2, done: 2 }, checklist: { current: null } });
      expect(done.completedAt).not.toBeNull();
      expect((await photo('cleanerA', id, bedroom, 'AFTER', 409)).code).toBe('CLEAN_COMPLETE');
      expect(
        (await t.as('cleanerA').post(`/v1/cleans/${id}/damage-check`, { found: true }).expect(409)).body.code,
      ).toBe('CLEAN_COMPLETE');

      // The admins and the property's owners hear it's ready, in the app and by email; the cleaner doesn't.
      const told = await t.prisma.notification.findMany({ where: { kind: 'CLEAN_COMPLETED' } });
      expect(told.map((n) => n.userId).sort()).toEqual([w.users.admin.id, w.users.ownerA.id].sort());
      expect(told[0]).toMatchObject({
        entityType: 'Clean',
        entityId: id,
        title: 'Property A is ready for guests',
        body: expect.stringContaining('2 rooms photographed before and after · no damage · 1 item to restock'),
      });
      expect(t.email.sent.map((m) => m.to).sort()).toEqual(['admin@example.test', 'ownera@example.test']);
      expect(t.email.sent[0]!.subject).toBe('Property A is ready for guests');

      // The photos are evidence the property's owner can see; another property's cleaner can't.
      const fileId = (await t.prisma.cleanPhoto.findFirstOrThrow({ where: { cleanId: id } })).fileId;
      await t.as('ownerA').get(`/v1/files/${fileId}/url`).expect(200);
      await t.as('cleanerB').get(`/v1/files/${fileId}/url`).expect(404);
    });

    it('takes a damage report from the clean when there is damage, and opens the next step once it’s sent', async () => {
      const id = w.cleans.todayA;
      await t.as('cleanerA').post(`/v1/cleans/${id}/start`).expect(200);
      const report = (body: object = {}, who = 'cleanerA') =>
        t.as(who).post(`/v1/properties/${w.propertyA.id}/damage-reports`, {
          title: 'Cracked mirror',
          description: 'The bathroom mirror has a crack across it.',
          severity: 'MODERATE',
          discoveredOn: '2026-10-01',
          cleanId: id,
          ...body,
        });
      expect((await report().expect(422)).body).toMatchObject({
        code: 'CLEAN_CHECKLIST_INCOMPLETE',
        waitingOn: 'BEFORE_PHOTOS',
      });
      for (const room of w.propertyA.roomIds) await photo('cleanerA', id, room, 'BEFORE');

      const yes = (await t.as('cleanerA').post(`/v1/cleans/${id}/damage-check`, { found: true }).expect(200)).body;
      expect(yes.checklist.damage).toEqual({ found: true, reports: [], done: false });
      const draft = (await report().expect(201)).body;
      const withDraft = (await t.as('cleanerA').get(`/v1/cleans/${id}`).expect(200)).body;
      expect(withDraft.checklist.damage).toMatchObject({ done: false, reports: [{ id: draft.id, status: 'DRAFT' }] });
      // Others don't see the cleaner's draft.
      expect((await t.as('ownerA').get(`/v1/cleans/${id}`).expect(200)).body.checklist.damage.reports).toEqual([]);

      await t
        .as('cleanerA')
        .post(`/v1/damage-reports/${draft.id}/photos`, await upload('cleanerA', w.propertyA.id, 'DAMAGE_PHOTO'))
        .expect(201);
      await t.as('cleanerA').post(`/v1/damage-reports/${draft.id}/submit`).expect(200);
      const sent = (await t.as('cleanerA').get(`/v1/cleans/${id}`).expect(200)).body;
      expect(sent.checklist).toMatchObject({
        damage: { found: true, done: true, reports: [{ id: draft.id, status: 'SUBMITTED', photoCount: 1 }] },
        current: 'STOCK_COUNT',
      });
      // A sent report can't be taken back by answering no.
      expect(
        (await t.as('cleanerA').post(`/v1/cleans/${id}/damage-check`, { found: false }).expect(422)).body.code,
      ).toBe('CLEAN_DAMAGE_REPORTED');
      // Only from a clean you're working, at that property.
      await report({}, 'cleanerB').expect(404);
      expect(
        (await report({ cleanId: w.cleans.a }).expect(409)).body.code, // cleanerA's, but not under way
      ).toBe('CLEAN_SCHEDULED');
      expect(
        (
          await t
            .as('admin')
            .post(`/v1/properties/${w.propertyB.id}/damage-reports`, {
              title: 'Scuff',
              description: 'A scuff on the wall.',
              severity: 'MINOR',
              discoveredOn: '2026-10-01',
              cleanId: id,
            })
            .expect(422)
        ).body.code,
      ).toBe('UNKNOWN_CLEAN');
    });

    it('answers yes when a report is made from the clean straight away', async () => {
      const id = w.cleans.todayA;
      await t.as('cleanerA').post(`/v1/cleans/${id}/start`).expect(200);
      for (const room of w.propertyA.roomIds) await photo('cleanerA', id, room, 'BEFORE');
      await t
        .as('cleanerA')
        .post(`/v1/properties/${w.propertyA.id}/damage-reports`, {
          title: 'Broken chair',
          description: 'A dining chair leg is snapped.',
          severity: 'MINOR',
          discoveredOn: '2026-10-01',
          cleanId: id,
        })
        .expect(201);
      expect((await t.as('cleanerA').get(`/v1/cleans/${id}`).expect(200)).body.checklist.damage).toMatchObject({
        found: true,
        done: false,
      });
    });

    it('refuses a room of another property, someone else’s upload, and photos before the clean has started', async () => {
      const id = w.cleans.todayA;
      expect((await photo('cleanerA', id, w.propertyA.roomIds[0]!, 'BEFORE', 409)).code).toBe('CLEAN_SCHEDULED');
      await t.as('cleanerA').post(`/v1/cleans/${id}/start`).expect(200);
      expect((await photo('cleanerA', id, w.propertyB.roomIds[0]!, 'BEFORE', 422)).code).toBe('UNKNOWN_ROOM');
      const theirs = await upload('admin');
      const res = await t
        .as('cleanerA')
        .post(`/v1/cleans/${id}/photos`, { roomId: w.propertyA.roomIds[0], phase: 'BEFORE', ...theirs })
        .expect(422);
      expect(res.body.code).toBe('UNKNOWN_FILE');
    });

    it('refuses to complete a property with no rooms set up', async () => {
      await t.prisma.room.updateMany({ where: { propertyId: w.propertyA.id }, data: { archivedAt: new Date() } });
      await t.as('cleanerA').post(`/v1/cleans/${w.cleans.todayA}/start`).expect(200);
      expect((await t.as('cleanerA').post(`/v1/cleans/${w.cleans.todayA}/complete`).expect(422)).body.code).toBe(
        'CLEAN_NO_ROOMS',
      );
    });
  });

  describe('database guarantees', () => {
    const sql = (q: string, ...args: unknown[]) => t.prisma.$executeRawUnsafe(q, ...args);

    it('never deletes a clean, allows only the workflow’s moves, and completes only with every photo', async () => {
      await expect(sql(`DELETE FROM "Clean" WHERE id = $1::uuid`, w.cleans.a)).rejects.toThrow(/cannot be deleted/);
      await expect(
        sql(
          `UPDATE "Clean" SET status = 'COMPLETE', "startedAt" = now(), "startedById" = $2::uuid,
             "completedAt" = now(), "completedById" = $2::uuid WHERE id = $1::uuid`,
          w.cleans.a,
          w.users.cleanerA.id,
        ),
      ).rejects.toThrow(/cannot go from SCHEDULED to COMPLETE/);
      await sql(
        `UPDATE "Clean" SET status = 'IN_PROGRESS', "startedAt" = now(), "startedById" = $2::uuid WHERE id = $1::uuid`,
        w.cleans.a,
        w.users.cleanerA.id,
      );
      await expect(
        sql(
          `UPDATE "Clean" SET status = 'COMPLETE', "completedAt" = now(), "completedById" = $2::uuid WHERE id = $1::uuid`,
          w.cleans.a,
          w.users.cleanerA.id,
        ),
      ).rejects.toThrow(/missing photos/);
      await expect(
        sql(`UPDATE "Clean" SET "propertyId" = $2::uuid WHERE id = $1::uuid`, w.cleans.a, w.propertyB.id),
      ).rejects.toThrow(/are fixed/);
    });

    it('freezes a complete clean, and keeps clean photos immutable and added only while under way', async () => {
      const id = w.cleans.todayA;
      // A photo can't be slipped onto a clean that hasn't started.
      const files = await upload('cleanerA');
      await expect(
        sql(
          `INSERT INTO "CleanPhoto" (id, "cleanId", "propertyId", "roomId", phase, "fileId", "thumbFileId", "uploadedById")
           VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, 'BEFORE', $4::uuid, $5::uuid, $6::uuid)`,
          id,
          w.propertyA.id,
          w.propertyA.roomIds[0],
          files.fileId,
          files.thumbFileId,
          w.users.cleanerA.id,
        ),
      ).rejects.toThrow(/only while the clean is in progress/);

      await t.as('cleanerA').post(`/v1/cleans/${id}/start`).expect(200);
      await prep('cleanerA', id);
      for (const room of w.propertyA.roomIds) await photo('cleanerA', id, room, 'AFTER');
      await t.as('cleanerA').post(`/v1/cleans/${id}/complete`).expect(200);
      const p = await t.prisma.cleanPhoto.findFirstOrThrow({ where: { cleanId: id } });
      await expect(sql(`UPDATE "CleanPhoto" SET phase = 'AFTER' WHERE id = $1::uuid`, p.id)).rejects.toThrow(
        /cannot be changed or deleted/,
      );
      await expect(sql(`DELETE FROM "CleanPhoto" WHERE id = $1::uuid`, p.id)).rejects.toThrow(
        /cannot be changed or deleted/,
      );
      await expect(
        sql(`UPDATE "Clean" SET "assignedCleanerId" = $2::uuid WHERE id = $1::uuid`, id, w.users.cleanerB.id),
      ).rejects.toThrow(/is complete/);
    });

    it('backs the checklist: after photos and completing wait on it, and a count belongs to a clean under way', async () => {
      const id = w.cleans.todayA;
      const insertPhoto = async (phase: 'BEFORE' | 'AFTER', roomId: string) => {
        const files = await upload('cleanerA');
        return sql(
          `INSERT INTO "CleanPhoto" (id, "cleanId", "propertyId", "roomId", phase, "fileId", "thumbFileId", "uploadedById")
           VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, $4::"PhotoPhase", $5::uuid, $6::uuid, $7::uuid)`,
          id,
          w.propertyA.id,
          roomId,
          phase,
          files.fileId,
          files.thumbFileId,
          w.users.cleanerA.id,
        );
      };
      const count = (cleanId: string, supplyItemId: string) =>
        sql(
          `INSERT INTO "SupplyStatus" (id, "supplyItemId", "levelPct", "reportedById", "cleanId")
           VALUES (gen_random_uuid(), $1::uuid, 50, $2::uuid, $3::uuid)`,
          supplyItemId,
          w.users.cleanerA.id,
          cleanId,
        );
      // A count can't be pinned on a clean that isn't under way.
      await expect(count(id, w.propertyA.supplyIds[0]!)).rejects.toThrow(/clean in progress/);

      await t.as('cleanerA').post(`/v1/cleans/${id}/start`).expect(200);
      for (const room of w.propertyA.roomIds) await insertPhoto('BEFORE', room);
      await expect(insertPhoto('AFTER', w.propertyA.roomIds[0]!)).rejects.toThrow(/checklist before them/);
      // ...nor on another property's item.
      await expect(count(id, w.propertyB.supplyIds[0]!)).rejects.toThrow(/at the item's property/);
      await sql(`UPDATE "Clean" SET "damageFound" = false WHERE id = $1::uuid`, id);
      for (const item of w.propertyA.supplyIds) await count(id, item);
      for (const room of w.propertyA.roomIds) await insertPhoto('AFTER', room);

      // With every photo but damage answered yes and no report sent, it can't complete.
      await sql(`UPDATE "Clean" SET "damageFound" = true WHERE id = $1::uuid`, id);
      const complete = () =>
        sql(
          `UPDATE "Clean" SET status = 'COMPLETE', "completedAt" = now(), "completedById" = $2::uuid WHERE id = $1::uuid`,
          id,
          w.users.cleanerA.id,
        );
      await expect(complete()).rejects.toThrow(/checklist is not done/);
      await sql(`UPDATE "Clean" SET "damageFound" = false WHERE id = $1::uuid`, id);
      await complete();
      await expect(sql(`UPDATE "Clean" SET "damageFound" = true WHERE id = $1::uuid`, id)).rejects.toThrow(
        /is complete/,
      );

      // A damage report's clean is fixed.
      await expect(
        sql(`UPDATE "DamageReport" SET "cleanId" = $2::uuid WHERE id = $1::uuid`, w.damage.draftA, id),
      ).rejects.toThrow(/clean are fixed/);
    });

    it('checks pay, turnovers and each state’s time', async () => {
      await expect(sql(`UPDATE "Clean" SET "cleanerPayCents" = -1 WHERE id = $1::uuid`, w.cleans.a)).rejects.toThrow(
        /clean_pay_not_negative/,
      );
      await expect(
        sql(
          `INSERT INTO "Clean" (id, "propertyId", kind, "scheduledDate", "updatedAt") VALUES (gen_random_uuid(), $1::uuid, 'TURNOVER', '2026-12-01', now())`,
          w.propertyA.id,
        ),
      ).rejects.toThrow(/clean_turnover_has_booking/);
      await expect(sql(`UPDATE "Clean" SET status = 'CANCELLED' WHERE id = $1::uuid`, w.cleans.a)).rejects.toThrow(
        /clean_cancelled_when_cancelled/,
      );
    });
  });
});
