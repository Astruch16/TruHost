import { createHash } from 'node:crypto';
import { createTestApp, type TestApp } from './support/app.js';
import { resetDb } from './support/db.js';
import { seedWorld, type World } from './support/world.js';

const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const pathOf = (url: string) => {
  const u = new URL(url);
  return `${u.pathname}${u.search}`;
};

describe('damage reports', () => {
  let t: TestApp;
  let w: World;
  /** A past Airbnb stay at property A (Oct 1 → 4), so a claim deadline applies: Oct 18. */
  let stay: string;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(async () => {
    await resetDb(t.prisma);
    t.identity.reset();
    t.email.reset();
    w = await seedWorld(t.prisma);
    stay = (
      await t.prisma.booking.create({
        data: {
          propertyId: w.propertyA.id,
          source: 'MANUAL',
          channel: 'AIRBNB',
          checkInDate: new Date('2026-10-01T00:00:00Z'),
          checkOutDate: new Date('2026-10-04T00:00:00Z'),
          guestName: 'Jordan Guest',
          payoutCents: 50_000,
          guestCleaningFeeCents: 9_000,
        },
      })
    ).id;
  });

  const create = (who: string, body: object = {}, propertyId = w.propertyA.id) =>
    t.as(who).post(`/v1/properties/${propertyId}/damage-reports`, {
      title: 'Burn mark on the counter',
      description: 'A pot burn mark on the kitchen counter, about 10 cm across.',
      severity: 'MODERATE',
      discoveredOn: '2026-10-04',
      bookingId: stay,
      roomId: w.propertyA.roomIds[0],
      estimatedCostCents: 40_000,
      ...body,
    });

  /** Uploads a damage photo (both renditions) as `who`; returns the ids to attach. */
  async function upload(who: string, propertyId = w.propertyA.id, purpose = 'DAMAGE_PHOTO') {
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

  describe('reporting', () => {
    it('a cleaner reports damage: a draft, then photos, then sent, which tells the admins and owners', async () => {
      // The stays a report could blame, with the guest's name for the cleaner.
      const stays = await t.as('cleanerA').get(`/v1/properties/${w.propertyA.id}/damage-report-stays?on=2026-10-04`);
      expect(stays.status).toBe(200);
      expect(stays.body.items).toEqual([
        {
          id: stay,
          guestName: 'Jordan Guest',
          checkInDate: '2026-10-01',
          checkOutDate: '2026-10-04',
          channel: 'AIRBNB',
        },
      ]);

      const draft = (await create('cleanerA').expect(201)).body;
      expect(draft).toMatchObject({
        status: 'DRAFT',
        claimDeadline: '2026-10-18',
        booking: { id: stay, guestName: 'Jordan Guest' },
        room: { displayName: 'Bedroom' },
        photoCount: 0,
        can: { edit: true, addPhotos: true, submit: true, manage: false },
      });
      // A draft is the reporter's (and admins'): not the owner's.
      await t.as('ownerA').get(`/v1/damage-reports/${draft.id}`).expect(404);
      const ownerList = (await t.as('ownerA').get(`/v1/properties/${w.propertyA.id}/damage-reports`).expect(200)).body;
      expect(ownerList.items.map((r: { id: string }) => r.id)).not.toContain(draft.id);

      // Not without a photo.
      const none = await t.as('cleanerA').post(`/v1/damage-reports/${draft.id}/submit`).expect(422);
      expect(none.body.code).toBe('DAMAGE_REPORT_NO_PHOTOS');

      await t
        .as('cleanerA')
        .post(`/v1/damage-reports/${draft.id}/photos`, await upload('cleanerA'))
        .expect(201);
      const sent = (await t.as('cleanerA').post(`/v1/damage-reports/${draft.id}/submit`).expect(200)).body;
      expect(sent).toMatchObject({ status: 'SUBMITTED', photoCount: 1, can: { edit: false, submit: false } });
      expect(sent.photos).toHaveLength(1);
      expect(sent.photos[0]).toMatchObject({ uploadedBy: { firstName: 'cleanerA' } });

      // Admins and the property's owner are told (not the cleaner who sent it).
      const told = await t.prisma.notification.findMany({
        where: { kind: 'DAMAGE_REPORTED' },
        include: { user: true },
      });
      expect(told.map((n) => n.user.firstName).sort()).toEqual(['admin', 'ownerA']);
      expect(told[0]!.title).toBe('Damage reported: Burn mark on the counter');
      expect(t.email.sent.map((m) => m.to).sort()).toEqual(['admin@example.test', 'ownera@example.test']);
      expect(t.email.sent[0]!.subject).toBe('Damage reported at Property A: Burn mark on the counter');
      const byTo = (to: string) => t.email.sent.find((m) => m.to === to)!.text;
      expect(byTo('admin@example.test')).toContain('https://app.truhost.example/admin/damage');
      expect(byTo('ownera@example.test')).toContain('https://app.truhost.example/owner/damage');
      expect(await t.prisma.auditLog.count({ where: { action: 'damage.submit', entityId: draft.id } })).toBe(1);

      // Now the owner sees it, without the guest's name (as on bookings).
      const forOwner = (await t.as('ownerA').get(`/v1/damage-reports/${draft.id}`).expect(200)).body;
      expect(forOwner).toMatchObject({ booking: { id: stay, guestName: null }, can: { edit: false, manage: false } });
      expect(forOwner.photos).toHaveLength(1);
    });

    it('follows each person’s Settings choice for damage reports', async () => {
      await t.prisma.notificationSetting.create({
        data: { userId: w.users.ownerA.id, category: 'DAMAGE_REPORTS', email: false, inApp: true },
      });
      const r = (await create('cleanerA').expect(201)).body;
      await t
        .as('cleanerA')
        .post(`/v1/damage-reports/${r.id}/photos`, await upload('cleanerA'))
        .expect(201);
      await t.as('cleanerA').post(`/v1/damage-reports/${r.id}/submit`).expect(200);
      expect(t.email.sent.map((m) => m.to)).toEqual(['admin@example.test']);
      expect(await t.prisma.notification.count({ where: { userId: w.users.ownerA.id } })).toBe(1);
    });

    it('an admin reporting isn’t told about their own report', async () => {
      const r = (await create('admin').expect(201)).body;
      await t
        .as('admin')
        .post(`/v1/damage-reports/${r.id}/photos`, await upload('admin'))
        .expect(201);
      await t.as('admin').post(`/v1/damage-reports/${r.id}/submit`).expect(200);
      const told = await t.prisma.notification.findMany({ include: { user: true } });
      expect(told.map((n) => n.user.firstName)).toEqual(['ownerA']);
    });

    it('checks what a report says: the day, the stay and the room belong', async () => {
      expect((await create('cleanerA', { discoveredOn: '2027-01-01' }).expect(422)).body.code).toBe(
        'DAMAGE_DATE_AHEAD',
      );
      expect((await create('cleanerA', { bookingId: w.bookings.b }).expect(422)).body.code).toBe('UNKNOWN_BOOKING');
      expect((await create('cleanerA', { roomId: w.propertyB.roomIds[0] }).expect(422)).body.code).toBe('UNKNOWN_ROOM');
      await create('cleanerA', { title: '   ' }).expect(400);
      await create('cleanerA', { estimatedCostCents: -1 }).expect(400);
      // Without a stay or room is fine (e.g. found during an owner stay).
      await create('cleanerA', { bookingId: null, roomId: null, estimatedCostCents: null }).expect(201);
    });

    it('attaches only the reporter’s own damage-photo uploads for this property', async () => {
      const r = (await create('cleanerA').expect(201)).body;
      const theirs = await upload('admin');
      expect((await t.as('cleanerA').post(`/v1/damage-reports/${r.id}/photos`, theirs).expect(422)).body.code).toBe(
        'UNKNOWN_FILE',
      );
      const receipt = await upload('cleanerA', w.propertyA.id, 'RECEIPT').catch(() => null);
      expect(receipt).toBeNull(); // cleaners can't upload receipts at all
      const elsewhere = await upload('admin', w.propertyB.id);
      expect((await t.as('admin').post(`/v1/damage-reports/${r.id}/photos`, elsewhere).expect(422)).body.code).toBe(
        'FILE_MISMATCH',
      );
    });
  });

  describe('once sent', () => {
    it('locks the details, but photos can still be added (audited)', async () => {
      const sent = w.damage.sentA;
      expect(
        (await t.as('cleanerA').patch(`/v1/damage-reports/${sent}`, { title: 'Changed' }).expect(409)).body.code,
      ).toBe('DAMAGE_REPORT_LOCKED');
      await t
        .as('cleanerA')
        .post(`/v1/damage-reports/${sent}/photos`, await upload('cleanerA'))
        .expect(201);
      expect(await t.prisma.auditLog.count({ where: { action: 'damage.photo.add', entityId: sent } })).toBe(1);
      expect((await t.as('admin').post(`/v1/damage-reports/${sent}/submit`).expect(409)).body.code).toBe(
        'DAMAGE_REPORT_ALREADY_SENT',
      );
    });

    it('admins move it forward with the claim’s details, never back; each step is audited', async () => {
      const sent = w.damage.sentA;
      const status = (body: object, who = 'admin') => t.as(who).post(`/v1/damage-reports/${sent}/status`, body);
      await status({ status: 'ACKNOWLEDGED' }, 'cleanerA').expect(404);
      const claim = (await status({ status: 'CLAIM_FILED', claimReference: 'HMX123' }).expect(200)).body;
      // Skipping a step fills it in.
      expect(claim).toMatchObject({ status: 'CLAIM_FILED', claimReference: 'HMX123' });
      expect(claim.acknowledgedAt).not.toBeNull();
      expect((await status({ status: 'ACKNOWLEDGED' }).expect(409)).body.code).toBe('DAMAGE_STATUS_BACKWARDS');
      const done = (
        await status({ status: 'RESOLVED', resolutionNote: 'AirCover paid $250.', estimatedCostCents: 25_000 }).expect(
          200,
        )
      ).body;
      expect(done).toMatchObject({
        status: 'RESOLVED',
        resolutionNote: 'AirCover paid $250.',
        can: { addPhotos: false },
      });
      expect(await t.prisma.auditLog.count({ where: { action: 'damage.status', entityId: sent } })).toBe(2);
      // Closed: no more photos.
      expect(
        (
          await t
            .as('admin')
            .post(`/v1/damage-reports/${sent}/photos`, await upload('admin'))
            .expect(409)
        ).body.code,
      ).toBe('DAMAGE_REPORT_CLOSED');
      // A draft can't be moved on.
      expect(
        (
          await t
            .as('admin')
            .post(`/v1/damage-reports/${w.damage.draftA}/status`, { status: 'ACKNOWLEDGED' })
            .expect(409)
        ).body.code,
      ).toBe('DAMAGE_REPORT_NOT_SENT');
    });

    it('admins list open and resolved reports across properties', async () => {
      await t.as('admin').post(`/v1/damage-reports/${w.damage.sentA}/status`, { status: 'RESOLVED' }).expect(200);
      const ids = async (status: string) =>
        (
          (await t.as('admin').get(`/v1/damage-reports?status=${status}`).expect(200)).body.items as { id: string }[]
        ).map((r) => r.id);
      expect(await ids('OPEN')).toEqual([w.damage.draftA]);
      expect(await ids('RESOLVED')).toEqual([w.damage.sentA]);
      expect((await ids('ALL')).sort()).toEqual([w.damage.sentA, w.damage.draftA].sort());
    });
  });

  describe('photos', () => {
    it('are seen by whoever can see the report', async () => {
      const file = w.damage.sentPhotoFile;
      await t.as('ownerA').get(`/v1/files/${file}/url`).expect(200);
      await t.as('cleanerA').get(`/v1/files/${file}/url`).expect(200);
      await t.as('ownerB').get(`/v1/files/${file}/url`).expect(404);
      await t.as('cleanerB').get(`/v1/files/${file}/url`).expect(404);
    });

    it('on a draft are the reporter’s and admins’ only', async () => {
      const files = await upload('cleanerA');
      await t.as('cleanerA').post(`/v1/damage-reports/${w.damage.draftA}/photos`, files).expect(201);
      await t.as('ownerA').get(`/v1/files/${files.fileId}/url`).expect(404);
      await t.as('admin').get(`/v1/files/${files.fileId}/url`).expect(200);
    });
  });

  describe('database guarantees', () => {
    it('photos can’t be changed or deleted', async () => {
      await expect(t.prisma.$executeRaw`UPDATE "DamagePhoto" SET "createdAt" = now()`).rejects.toThrow(
        /cannot be changed or deleted/,
      );
      await expect(t.prisma.$executeRaw`DELETE FROM "DamagePhoto"`).rejects.toThrow(/cannot be changed or deleted/);
    });

    it('reports can’t be deleted; once sent their details are locked and the status only moves forward', async () => {
      const sent = w.damage.sentA;
      await expect(t.prisma.$executeRaw`DELETE FROM "DamageReport" WHERE id = ${sent}::uuid`).rejects.toThrow(
        /cannot be deleted/,
      );
      await expect(
        t.prisma.$executeRaw`UPDATE "DamageReport" SET title = 'Edited' WHERE id = ${sent}::uuid`,
      ).rejects.toThrow(/locked once submitted/);
      await expect(
        t.prisma.$executeRaw`UPDATE "DamageReport" SET "bookingId" = NULL WHERE id = ${sent}::uuid`,
      ).rejects.toThrow(/locked once submitted/);
      await expect(
        t.prisma.$executeRaw`UPDATE "DamageReport" SET status = 'DRAFT', "submittedAt" = NULL WHERE id = ${sent}::uuid`,
      ).rejects.toThrow(/only moves forward/);
      await expect(
        t.prisma
          .$executeRaw`UPDATE "DamageReport" SET "reportedById" = ${w.users.admin.id}::uuid WHERE id = ${w.damage.draftA}::uuid`,
      ).rejects.toThrow(/property, reporter and clean are fixed/);
      // A draft's details can change.
      await t.prisma.$executeRaw`UPDATE "DamageReport" SET title = 'Chipped mugs' WHERE id = ${w.damage.draftA}::uuid`;
    });

    it('checks titles, costs, sent and resolved times, and that the stay is at the same property', async () => {
      const draft = w.damage.draftA;
      await expect(
        t.prisma.$executeRaw`UPDATE "DamageReport" SET title = ' Untidy' WHERE id = ${draft}::uuid`,
      ).rejects.toThrow(/damage_report_title_tidy/);
      await expect(
        t.prisma.$executeRaw`UPDATE "DamageReport" SET "estimatedCostCents" = -1 WHERE id = ${draft}::uuid`,
      ).rejects.toThrow(/damage_report_cost_not_negative/);
      await expect(
        t.prisma.$executeRaw`UPDATE "DamageReport" SET status = 'SUBMITTED' WHERE id = ${draft}::uuid`,
      ).rejects.toThrow(/damage_report_submitted_when_sent/);
      await expect(
        t.prisma
          .$executeRaw`UPDATE "DamageReport" SET status = 'RESOLVED', "submittedAt" = now() WHERE id = ${draft}::uuid`,
      ).rejects.toThrow(/damage_report_resolved_when_resolved/);
      await expect(
        t.prisma.$executeRaw`UPDATE "DamageReport" SET "bookingId" = ${w.bookings.b}::uuid WHERE id = ${draft}::uuid`,
      ).rejects.toThrow(/DamageReport_propertyId_bookingId_fkey/);
    });
  });

  it('a property with damage reports can’t be deleted (they’re evidence)', async () => {
    const p = (
      await t
        .as('admin')
        .post('/v1/properties', {
          name: 'Spare Cabin',
          addressLine1: '9 Sample Rd',
          city: 'Hope',
          postalCode: 'V0X 1L0',
        })
        .expect(201)
    ).body;
    await create('admin', { bookingId: null, roomId: null }, p.id).expect(201);
    const check = (await t.as('admin').get(`/v1/properties/${p.id}/deletion`).expect(200)).body;
    expect(check).toMatchObject({ allowed: false, damageReports: 1 });
    expect((await t.as('admin').delete(`/v1/properties/${p.id}`).expect(409)).body.code).toBe('PROPERTY_HAS_RECORDS');
  });
});
