import { createHash } from 'node:crypto';
import { createTestApp, type TestApp } from './support/app.js';
import { resetDb } from './support/db.js';
import { seedWorld, type World } from './support/world.js';

/**
 * The owner portal's API: own properties only, released statements only, owner-safe fields, and figures that match
 * the released statement copies. The clock is Nov 20, 2026.
 */
describe('owner portal', () => {
  let t: TestApp;
  let w: World;
  let A: string;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(async () => {
    await resetDb(t.prisma);
    t.email.reset();
    w = await seedWorld(t.prisma);
    A = w.propertyA.id;
    await t.prisma.property.update({ where: { id: A }, data: { standardCleaningFeeCents: 15_000 } });
  });

  const admin = () => t.as('admin');

  async function booking(body: Record<string, unknown>) {
    return (
      await admin()
        .post(`/v1/properties/${A}/bookings`, { channel: 'AIRBNB', ...body })
        .expect(201)
    ).body as {
      id: string;
    };
  }

  /** Property A's September (a stay crossing in from August, a stay, an owner stay, an expense), released. */
  async function releaseSeptember() {
    await booking({
      checkInDate: '2026-08-29',
      checkOutDate: '2026-09-03',
      payoutCents: 110_003,
      guestCleaningFeeCents: 10_000,
      guestName: 'Pat Private',
    });
    await booking({
      checkInDate: '2026-09-10',
      checkOutDate: '2026-09-13',
      payoutCents: 61_000,
      guestCleaningFeeCents: 9_000,
    });
    await booking({ kind: 'OWNER_STAY', checkInDate: '2026-09-20', checkOutDate: '2026-09-22' });
    const e = await admin()
      .post(`/v1/properties/${A}/expenses`, {
        category: 'SUPPLIES',
        description: 'Restock',
        vendor: 'Costco',
        incurredOn: '2026-09-05',
        amountCents: 6_420,
      })
      .expect(201);
    const fileId = crypto.randomUUID();
    await t.prisma.storedFile.create({
      data: {
        id: fileId,
        purpose: 'RECEIPT',
        propertyId: A,
        objectKey: `properties/${A}/receipt/${fileId}`,
        contentType: 'application/pdf',
        sizeBytes: 10,
        sha256: 'c'.repeat(64),
        status: 'VERIFIED',
        verifiedAt: new Date(),
        uploadedById: w.users.admin.id,
      },
    });
    await t.prisma.receipt.create({
      data: {
        propertyId: A,
        expenseId: e.body.id,
        fileId,
        receiptDate: new Date('2026-09-05T00:00:00Z'),
        uploadedById: w.users.admin.id,
      },
    });
    const draft = await admin().post(`/v1/properties/${A}/statements`, { month: '2026-09' }).expect(200);
    await admin().post(`/v1/statements/${draft.body.id}/finalize`, {}).expect(200);
    const released = await admin()
      .post(`/v1/statements/${draft.body.id}/release`, { releasedOn: '2026-10-05', paymentReference: 'ETF-88412' })
      .expect(200);
    return released.body as { id: string; totals: { netCents: number; grossCents: number; nightsBooked: number } };
  }

  describe('statements', () => {
    it('lists only released statements of the owner’s own properties, newest first', async () => {
      const sep = await releaseSeptember();
      // Property A also has October as a draft (the world), and property B a finalized December: neither shows.
      const a = await t.as('ownerA').get('/v1/owner/statements').expect(200);
      expect(a.body.items).toEqual([
        {
          id: sep.id,
          property: { id: A, name: 'Property A' },
          month: '2026-09',
          netCents: 50_340,
          grossCents: 92_000,
          releasedOn: '2026-10-05',
        },
      ]);
      const b = await t.as('ownerB').get('/v1/owner/statements').expect(200);
      expect(b.body.items.map((s: { id: string }) => s.id)).toEqual([w.statements.releasedB]);
      await t.as('ownerA').get(`/v1/owner/statements?propertyId=${w.propertyB.id}`).expect(404);
      await t.as('cleanerA').get('/v1/owner/statements').expect(404);
    });

    it('shows a released statement’s stored copy without guest details', async () => {
      const sep = await releaseSeptember();
      const res = await t.as('ownerA').get(`/v1/owner/statements/${sep.id}`).expect(200);
      expect(res.body).toMatchObject({
        month: '2026-09',
        plan: { name: 'TruPlan', managementFeeBps: 2200 },
        totals: {
          grossCents: 92_000,
          managementFeeCents: 20_240,
          expensesCents: 6_420,
          ownerStayCleaningCents: 15_000,
          netCents: 50_340,
        },
        released: { on: '2026-10-05', paymentReference: 'ETF-88412' },
      });
      expect(res.body.lines[0]).toMatchObject({
        kind: 'STAY',
        nights: 2,
        totalNights: 5,
        stayGrossCents: 100_003,
        amountCents: 40_000,
      });
      expect(JSON.stringify(res.body)).not.toContain('Pat Private');
      expect(res.body.lines.find((l: { kind: string }) => l.kind === 'EXPENSE').receipts).toHaveLength(1);
    });

    it('refuses another owner’s statement or PDF, and unreleased ones, by id', async () => {
      const sep = await releaseSeptember();
      await t.as('ownerB').get(`/v1/owner/statements/${sep.id}`).expect(404);
      await t.as('ownerB').get(`/v1/owner/statements/${sep.id}/pdf`).expect(404);
      await t.as('cleanerA').get(`/v1/owner/statements/${sep.id}`).expect(404);
      await t.as('ownerA').get(`/v1/owner/statements/${w.statements.draftA}`).expect(404);
      await t.as('ownerB').get(`/v1/owner/statements/${w.statements.finalizedB}`).expect(404);
      // The admin pages' own statement route stays admin-only.
      await t.as('ownerA').get(`/v1/statements/${sep.id}`).expect(404);
      const pdfFile = (await t.prisma.ownerStatement.findUniqueOrThrow({ where: { id: sep.id } })).pdfFileId!;
      await t.as('ownerB').get(`/v1/files/${pdfFile}/url`).expect(404);
    });

    it('links the owner to their stored PDF', async () => {
      const sep = await releaseSeptember();
      const link = await t.as('ownerA').get(`/v1/owner/statements/${sep.id}/pdf`).expect(200);
      const url = new URL(link.body.url as string);
      const pdf = await t
        .http()
        .get(`${url.pathname}${url.search}`)
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);
      const file = await t.prisma.storedFile.findFirstOrThrow({ where: { statementPdf: { id: sep.id } } });
      expect(
        createHash('sha256')
          .update(pdf.body as Buffer)
          .digest('hex'),
      ).toBe(file.sha256);
      expect(Date.parse(link.body.expiresAt) - Date.now()).toBeLessThanOrEqual(5 * 60_000);
    });

    it('emails the owners on release, with a link to the statement in the portal', async () => {
      const sep = await releaseSeptember();
      // Property A's owners: ownerA, and the admin (who owns it too).
      expect(t.email.sent.map((m) => m.to).sort()).toEqual(['admin@example.test', 'ownera@example.test']);
      expect(t.email.sent[0]!.text).toContain(`https://app.truhost.example/owner/statements/${sep.id}`);
      expect(t.email.sent[0]!.text).toContain('$503.40');
    });
  });

  describe('home', () => {
    it('leads with the latest released statement, and its numbers match the stored copies', async () => {
      const sep = await releaseSeptember();
      const res = await t.as('ownerA').get(`/v1/owner/home?propertyId=${A}`).expect(200);
      expect(res.body.latest).toEqual({
        month: '2026-09',
        statementIds: [sep.id],
        netCents: sep.totals.netCents,
        grossCents: sep.totals.grossCents,
        nightsBooked: sep.totals.nightsBooked,
        releasedOn: '2026-10-05',
        change: null,
      });
      expect(res.body.yearToDate).toMatchObject({ year: 2026, months: 1, netCents: 50_340, nightsBooked: 5 });
      expect(res.body.netByMonth.find((m: { month: string }) => m.month === '2026-09')).toEqual({
        month: '2026-09',
        netCents: 50_340,
        state: 'RELEASED',
      });
      expect(res.body.netByMonth.find((m: { month: string }) => m.month === '2026-10')).toEqual({
        month: '2026-10',
        netCents: null,
        state: 'PENDING',
      });
      expect(res.body.netByMonth.at(-1)).toMatchObject({ month: '2026-11', state: 'IN_PROGRESS' });
    });

    it('estimates this month from the stays booked, with nights stayed and to come', async () => {
      // World: Nov 10 → 13 at property A (gross 51_000). Today is Nov 20: all three nights stayed.
      await booking({ checkInDate: '2026-11-25', checkOutDate: '2026-11-28' }); // payout not in yet
      const res = await t.as('ownerA').get(`/v1/owner/home?propertyId=${A}`).expect(200);
      const summary = await admin().get(`/v1/properties/${A}/summary?month=2026-11`).expect(200);
      expect(res.body.thisMonth).toEqual({
        month: '2026-11',
        estimatedNetCents: summary.body.netCents,
        grossCents: 51_000,
        nightsBooked: 6,
        nightsStayed: 3,
        nightsUpcoming: 3,
        daysInMonth: 30,
        stays: 2,
        pendingPayouts: 1,
        statementExpected: '2026-12',
      });
      expect(res.body.latest).toBeNull();
    });

    it('lists coming stays without guest details, and recent owner-paid expenses in plain words', async () => {
      await booking({ checkInDate: '2026-11-25', checkOutDate: '2026-11-28', guestName: 'Secret Guest' });
      await booking({ kind: 'OWNER_STAY', checkInDate: '2026-12-02', checkOutDate: '2026-12-05' });
      const res = await t.as('ownerA').get('/v1/owner/home').expect(200);
      expect(res.body.comingUp.map((c: { kind: string; checkInDate: string }) => [c.kind, c.checkInDate])).toEqual([
        ['GUEST', '2026-11-25'],
        ['OWNER_STAY', '2026-12-02'],
      ]);
      expect(JSON.stringify(res.body)).not.toContain('Secret Guest');
      // The world's owner-borne expense (Nov 5) shows; its TruHost-borne one never does.
      expect(res.body.goodToKnow).toEqual([
        expect.objectContaining({
          kind: 'EXPENSE',
          title: 'Paper towels and coffee',
          detail: 'Supplies from Sample Supply Co, paid from your earnings',
          amountCents: -4_199,
          receiptFileId: w.files.a,
        }),
      ]);
    });

    it('sums every owned property, and only those', async () => {
      const res = await t.as('ownerB').get('/v1/owner/home').expect(200);
      expect(res.body.properties).toBe(1);
      expect(res.body.latest).toMatchObject({ month: '2025-11', netCents: 12_345 });
      await t.as('ownerB').get(`/v1/owner/home?propertyId=${A}`).expect(404);
      await t.as('outsider').get('/v1/owner/home').expect(404);
    });
  });

  describe('earnings by month', () => {
    it('gives a released month’s statement figures exactly, and an estimate for months not released', async () => {
      const sep = await releaseSeptember();
      const res = await t.as('ownerA').get(`/v1/owner/month?month=2026-09&propertyId=${A}`).expect(200);
      expect(res.body).toMatchObject({
        month: '2026-09',
        basis: 'RELEASED',
        statementIds: [sep.id],
        releasedOn: '2026-10-05',
        netCents: 50_340,
        grossCents: 92_000,
        managementFeeCents: 20_240,
        expensesCents: 6_420 + 15_000,
        adjustmentsCents: 0,
        nightsBooked: 5,
        estimatedProperties: 0,
        timing: 'PAST',
      });
      // August isn't released: estimated by the same functions as the owner's summary.
      const aug = await t.as('ownerA').get(`/v1/properties/${A}/summary?month=2026-08`).expect(200);
      expect(res.body.change).toEqual({
        month: '2026-08',
        netCents: aug.body.netCents,
        changeCents: 50_340 - aug.body.netCents,
      });

      const nov = await t.as('ownerA').get(`/v1/owner/month?month=2026-11&propertyId=${A}`).expect(200);
      const summary = await t.as('ownerA').get(`/v1/properties/${A}/summary?month=2026-11`).expect(200);
      expect(nov.body).toMatchObject({
        basis: 'ESTIMATE',
        statementIds: [],
        releasedOn: null,
        netCents: summary.body.netCents,
        grossCents: summary.body.grossCents,
        timing: 'CURRENT',
      });
      expect((await t.as('ownerA').get(`/v1/owner/month?month=2027-01&propertyId=${A}`).expect(200)).body.timing).toBe(
        'FUTURE',
      );
    });

    it('mixes released and estimated properties, and only ever the owner’s own', async () => {
      await releaseSeptember();
      await t.prisma.membership.create({
        data: { userId: w.users.ownerA.id, propertyId: w.propertyB.id, role: 'OWNER' },
      });
      const both = await t.as('ownerA').get('/v1/owner/month?month=2026-09').expect(200);
      expect(both.body).toMatchObject({ basis: 'MIXED', estimatedProperties: 1 });
      expect(both.body.statementIds).toHaveLength(1);
      // Owner B alone never sees property A's month.
      await t.as('ownerB').get(`/v1/owner/month?month=2026-09&propertyId=${A}`).expect(404);
      const b = await t.as('ownerB').get('/v1/owner/month?month=2026-09').expect(200);
      expect(b.body).toMatchObject({ basis: 'ESTIMATE', statementIds: [] });
      await t.as('cleanerA').get('/v1/owner/month?month=2026-09').expect(404);
    });
  });

  describe('supplies', () => {
    it('shows each owned property’s levels, those to restock first, and nobody else’s', async () => {
      // Property A: toilet paper half full (restock point 25%: "low soon"), coffee pods out.
      const [toiletPaper, coffee] = w.propertyA.supplyIds;
      const reading = (supplyItemId: string, levelPct: number) =>
        t.prisma.supplyStatus.create({ data: { supplyItemId, levelPct, reportedById: w.users.cleanerA.id } });
      await reading(toiletPaper!, 50);
      await reading(coffee!, 0);
      // Property B: one reading, which owner A must never see.
      await t.prisma.supplyStatus.create({
        data: { supplyItemId: w.propertyB.supplyIds[0]!, levelPct: 75, reportedById: w.users.cleanerB.id },
      });

      const a = await t.as('ownerA').get('/v1/owner/supplies').expect(200);
      expect(a.body.properties).toHaveLength(1);
      const [prop] = a.body.properties;
      expect(prop.property).toEqual({ id: A, name: 'Property A' });
      expect(
        prop.items.map((i: { name: string; levelPct: number; urgency: string | null }) => [
          i.name,
          i.levelPct,
          i.urgency,
        ]),
      ).toEqual([
        ['Coffee pods', 0, 'OUT'],
        ['Toilet paper', 50, 'SOON'],
      ]);
      expect(prop.counts).toEqual({ total: 2, out: 1, low: 0, soon: 1, unchecked: 0 });
      expect(prop.lastCheckedAt).not.toBeNull();
      expect(JSON.stringify(a.body)).not.toContain(w.propertyB.id);

      const b = await t.as('ownerB').get('/v1/owner/supplies').expect(200);
      expect(b.body.properties.map((p: { property: { id: string } }) => p.property.id)).toEqual([w.propertyB.id]);
      expect(b.body.properties[0].counts).toEqual({ total: 2, out: 0, low: 0, soon: 0, unchecked: 1 });

      await t.as('ownerB').get(`/v1/owner/supplies?propertyId=${A}`).expect(404);
      await t.as('cleanerA').get('/v1/owner/supplies').expect(404);
      await t.as('outsider').get('/v1/owner/supplies').expect(404);
    });
  });

  describe('damage', () => {
    it('lists sent reports at the owner’s properties only, with the stay but never the guest', async () => {
      // World: at property A, a sent report (blaming booking A, guest "Guest Person") and a draft.
      const a = await t.as('ownerA').get('/v1/owner/damage').expect(200);
      expect(a.body.items.map((r: { id: string }) => r.id)).toEqual([w.damage.sentA]);
      const [report] = a.body.items;
      expect(report).toMatchObject({
        title: 'Wine stain on the sofa',
        status: 'SUBMITTED',
        booking: { checkInDate: '2026-11-10', checkOutDate: '2026-11-13', guestName: null },
        can: { edit: false, addPhotos: false, submit: false, manage: false },
      });
      expect(JSON.stringify(a.body)).not.toContain('Guest Person');

      const one = await t.as('ownerA').get(`/v1/owner/damage/${w.damage.sentA}`).expect(200);
      expect(one.body.photos).toHaveLength(1);
      expect(one.body.booking.guestName).toBeNull();

      // The admin owns property A too: through the owner portal they see exactly what any owner sees.
      const adminView = await t.as('admin').get(`/v1/owner/damage/${w.damage.sentA}`).expect(200);
      expect(adminView.body.booking.guestName).toBeNull();
      expect(adminView.body.can.manage).toBe(false);

      expect((await t.as('ownerB').get('/v1/owner/damage').expect(200)).body.items).toEqual([]);
      await t.as('ownerB').get(`/v1/owner/damage/${w.damage.sentA}`).expect(404);
      await t.as('ownerB').get(`/v1/owner/damage?propertyId=${A}`).expect(404);
      await t.as('ownerA').get(`/v1/owner/damage/${w.damage.draftA}`).expect(404);
      await t.as('cleanerA').get('/v1/owner/damage').expect(404);
    });
  });

  describe('calendar', () => {
    it('shows the month’s stays with nights and the owner’s share, never guest details', async () => {
      await booking({
        checkInDate: '2026-11-28',
        checkOutDate: '2026-12-02',
        payoutCents: 49_000,
        guestCleaningFeeCents: 9_000,
        guestName: 'Hidden',
      });
      await booking({ kind: 'BLOCK', checkInDate: '2026-11-20', checkOutDate: '2026-11-22' });
      const res = await t.as('ownerA').get(`/v1/owner/calendar?month=2026-11&propertyId=${A}`).expect(200);
      expect(
        res.body.items.map((i: { kind: string; checkInDate: string; nightsInMonth: number }) => [
          i.kind,
          i.checkInDate,
          i.nightsInMonth,
        ]),
      ).toEqual([
        ['GUEST', '2026-11-10', 3],
        ['BLOCK', '2026-11-20', 2],
        ['GUEST', '2026-11-28', 3],
      ]);
      // 40_000 over 4 nights: 10_000 a night, three in November (28, 29, 30).
      expect(res.body.items[2]).toMatchObject({ ownerGrossCents: 40_000, monthShareCents: 30_000, nights: 4 });
      expect(res.body.items[1]).toMatchObject({ ownerGrossCents: null, monthShareCents: null, channel: null });
      expect(JSON.stringify(res.body)).not.toContain('Hidden');
    });
  });
});
