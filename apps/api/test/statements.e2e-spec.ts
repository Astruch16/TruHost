import { createHash } from 'node:crypto';
import { FILE_STORAGE, type FileStorage } from '../src/files/storage.js';
import { createTestApp, type TestApp } from './support/app.js';
import { resetDb } from './support/db.js';
import { seedWorld, type World } from './support/world.js';

/**
 * Owner statements end to end (docs/spec.md §4): live drafts, finalize (copy and lock), release (PDF stored), and
 * adjustments carried to the next month. The clock is Nov 20, 2026, so September and October are over.
 */
describe('owner statements', () => {
  let t: TestApp;
  let w: World;
  let storage: FileStorage;
  let A: string;

  beforeAll(async () => {
    t = await createTestApp();
    storage = t.app.get(FILE_STORAGE);
  });
  afterAll(() => t.close());
  beforeEach(async () => {
    await resetDb(t.prisma);
    t.email.reset();
    t.clock.reset();
    w = await seedWorld(t.prisma);
    A = w.propertyA.id;
    await t.prisma.property.update({ where: { id: A }, data: { standardCleaningFeeCents: 15_000 } });
  });

  const admin = () => t.as('admin');

  async function booking(body: Record<string, unknown>, propertyId = A) {
    const res = await admin()
      .post(`/v1/properties/${propertyId}/bookings`, { channel: 'AIRBNB', ...body })
      .expect(201);
    return res.body as { id: string; version: number };
  }

  async function expense(body: Record<string, unknown>, { receipt = true } = {}) {
    const res = await admin()
      .post(`/v1/properties/${A}/expenses`, { category: 'SUPPLIES', description: 'Restock', bearer: 'OWNER', ...body })
      .expect(201);
    if (receipt) {
      const fileId = crypto.randomUUID();
      await t.prisma.storedFile.create({
        data: {
          id: fileId,
          purpose: 'RECEIPT',
          propertyId: A,
          objectKey: `properties/${A}/receipt/${fileId}`,
          contentType: 'application/pdf',
          sizeBytes: 100,
          sha256: 'b'.repeat(64),
          status: 'VERIFIED',
          verifiedAt: new Date(),
          uploadedById: w.users.admin.id,
        },
      });
      await t.prisma.receipt.create({
        data: {
          propertyId: A,
          expenseId: res.body.id,
          fileId,
          receiptDate: new Date(`${body.incurredOn as string}T00:00:00Z`),
          uploadedById: w.users.admin.id,
        },
      });
    }
    return res.body as { id: string; version: number };
  }

  /** September at property A: a stay crossing in from August, a stay, an owner stay, and expenses. */
  async function september() {
    const crossing = await booking({
      checkInDate: '2026-08-29',
      checkOutDate: '2026-09-03',
      payoutCents: 110_003,
      guestCleaningFeeCents: 10_000,
      guestName: 'Pat Crossing',
    });
    const inside = await booking({
      checkInDate: '2026-09-10',
      checkOutDate: '2026-09-13',
      payoutCents: 61_000,
      guestCleaningFeeCents: 9_000,
    });
    const owner = await booking({ kind: 'OWNER_STAY', checkInDate: '2026-09-20', checkOutDate: '2026-09-22' });
    const supplies = await expense({ incurredOn: '2026-09-05', amountCents: 6_420, vendor: 'Costco' });
    await expense({ incurredOn: '2026-09-06', amountCents: 9_999, bearer: 'TRUHOST' }, { receipt: false });
    const draft = await admin().post(`/v1/properties/${A}/statements`, { month: '2026-09' }).expect(200);
    return { crossing, inside, owner, supplies, id: draft.body.id as string };
  }

  // Gross: 40_000 (2 of 5 nights of 100_003: 20_001 × 3 in August, 20_000 × 2 in September) + 52_000 = 92_000.
  // Fee: 22% = 20_240. Expenses 6_420. Owner-stay cleaning 15_000. Net 50_340.
  const SEPTEMBER = {
    nightsBooked: 5,
    grossCents: 92_000,
    managementFeeBps: 2200,
    managementFeeCents: 20_240,
    expensesCents: 6_420,
    ownerStayCleaningCents: 15_000,
    adjustmentsCents: 0,
    netCents: 50_340,
  };

  describe('drafts', () => {
    it('compute live from bookings, expenses and the plan, with the per-night split shown', async () => {
      const s = await september();
      const res = await admin().get(`/v1/statements/${s.id}`).expect(200);
      expect(res.body).toMatchObject({ status: 'DRAFT', month: '2026-09', totals: SEPTEMBER, blockers: [] });
      expect(res.body.plan).toEqual({ name: 'TruPlan', managementFeeBps: 2200 });
      expect(res.body.lines.map((l: { kind: string; amountCents: number }) => [l.kind, l.amountCents])).toEqual([
        ['STAY', 40_000],
        ['STAY', 52_000],
        ['OWNER_STAY_CLEANING', -15_000],
        ['EXPENSE', -6_420],
      ]);
      expect(res.body.lines[0]).toMatchObject({
        nights: 2,
        totalNights: 5,
        stayGrossCents: 100_003,
        guestName: 'Pat Crossing',
        channel: 'AIRBNB',
      });
      expect(res.body.lines[3].receipts).toHaveLength(1);
      expect(res.body.can).toEqual({ finalize: true, release: false, adjust: true, preview: true });

      // A draft follows the records: change a payout and it recalculates.
      await admin()
        .patch(`/v1/bookings/${s.inside.id}`, { version: s.inside.version, payoutCents: 71_000 })
        .expect(200);
      const after = await admin().get(`/v1/statements/${s.id}`).expect(200);
      expect(after.body.totals).toMatchObject({ grossCents: 102_000, managementFeeCents: 22_440, netCents: 58_140 });
    });

    it('agree with the dashboard figures for the month', async () => {
      const s = await september();
      const summary = await admin().get(`/v1/properties/${A}/summary?month=2026-09`).expect(200);
      const st = await admin().get(`/v1/statements/${s.id}`).expect(200);
      expect(summary.body).toMatchObject({
        grossCents: st.body.totals.grossCents,
        managementFeeCents: st.body.totals.managementFeeCents,
        ownerExpensesCents: st.body.totals.expensesCents + st.body.totals.ownerStayCleaningCents,
        ownerStayCleaningCents: 15_000,
        netCents: st.body.totals.netCents,
      });
    });

    it('are created once per property and month, never ahead of time or before a finalized month', async () => {
      const first = await admin().post(`/v1/properties/${A}/statements`, { month: '2026-09' }).expect(200);
      const again = await admin().post(`/v1/properties/${A}/statements`, { month: '2026-09' }).expect(200);
      expect(again.body.id).toBe(first.body.id);
      expect(await t.prisma.ownerStatement.count({ where: { propertyId: A } })).toBe(2); // with the world's October

      const future = await admin().post(`/v1/properties/${A}/statements`, { month: '2026-12' }).expect(422);
      expect(future.body.code).toBe('MONTH_IN_FUTURE');
      await admin().post(`/v1/properties/${A}/statements`, { month: '2026-11' }).expect(200); // the month in progress

      // Property B's December 2025 is finalized: November 2025 can't be started after it.
      const early = await admin().post(`/v1/properties/${w.propertyB.id}/statements`, { month: '2025-11' }).expect(409);
      expect(early.body.code).toBe('STATEMENT_OUT_OF_ORDER');
    });

    it('list every property for a month, and generate the missing drafts', async () => {
      await september();
      const before = await admin().get('/v1/statements?month=2026-09').expect(200);
      expect(
        before.body.items.map((r: { property: { name: string }; state: string }) => [r.property.name, r.state]),
      ).toEqual([
        ['Property A', 'DRAFT'],
        ['Property B', 'NOT_STARTED'],
      ]);
      expect(before.body.items[0]).toMatchObject({ netCents: 50_340, grossCents: 92_000, blockers: 0 });
      // Property B has no plan: its row says something blocks it.
      expect(before.body.items[1]).toMatchObject({ statementId: null, blockers: 1 });

      const generated = await admin().post('/v1/statements/generate', { month: '2026-09' }).expect(200);
      expect(generated.body.created).toBe(1);
      expect(generated.body.totals.counts).toEqual({ NOT_STARTED: 0, DRAFT: 2, FINALIZED: 0, RELEASED: 0 });
      const again = await admin().post('/v1/statements/generate', { month: '2026-09' }).expect(200);
      expect(again.body.created).toBe(0);
      expect(await t.prisma.auditLog.count({ where: { action: 'statement.create' } })).toBe(2);
    });
  });

  describe('finalize', () => {
    it('is blocked until the month is over, receipts are in, a plan applies and earlier months are done', async () => {
      // The world's October draft is an earlier draft for November, and November isn't over.
      const nov = await admin().post(`/v1/properties/${A}/statements`, { month: '2026-11' }).expect(200);
      expect(nov.body.blockers.map((b: { code: string }) => b.code)).toEqual(['MONTH_NOT_OVER', 'EARLIER_DRAFT']);
      expect(nov.body.can.finalize).toBe(false);
      const res = await admin().post(`/v1/statements/${nov.body.id}/finalize`, {}).expect(422);
      expect(res.body).toMatchObject({ code: 'STATEMENT_BLOCKED' });
      expect(res.body.blockers[1]).toMatchObject({ code: 'EARLIER_DRAFT', statementId: w.statements.draftA });

      const missing = await expense({ incurredOn: '2026-09-07', amountCents: 1_000 }, { receipt: false });
      const sep = await admin().post(`/v1/properties/${A}/statements`, { month: '2026-09' }).expect(200);
      expect(sep.body.blockers).toEqual([
        { code: 'MISSING_RECEIPTS', message: 'One expense needs a receipt.', expenseIds: [missing.id] },
      ]);

      const b = await admin().post(`/v1/properties/${w.propertyB.id}/statements`, { month: '2026-09' }).expect(200);
      expect(b.body.blockers.map((x: { code: string }) => x.code)).toEqual(['NO_PLAN']);
      expect(await t.prisma.ownerStatementLine.count()).toBe(0);
    });

    it('asks before finalizing stays still waiting on their payout, then counts them at $0', async () => {
      const s = await september();
      const pending = await booking({ checkInDate: '2026-09-25', checkOutDate: '2026-09-28', guestName: 'Late Payer' });
      const draft = await admin().get(`/v1/statements/${s.id}`).expect(200);
      expect(draft.body.pendingPayouts).toEqual([
        {
          bookingId: pending.id,
          checkInDate: '2026-09-25',
          checkOutDate: '2026-09-28',
          channel: 'AIRBNB',
          guestName: 'Late Payer',
        },
      ]);
      const res = await admin().post(`/v1/statements/${s.id}/finalize`, {}).expect(409);
      expect(res.body).toMatchObject({ code: 'PAYOUTS_PENDING', bookingIds: [pending.id] });
      expect((await admin().get(`/v1/statements/${s.id}`)).body.status).toBe('DRAFT');

      const done = await admin().post(`/v1/statements/${s.id}/finalize`, { confirmPendingPayouts: true }).expect(200);
      expect(done.body.status).toBe('FINALIZED');
      expect(done.body.totals).toEqual({ ...SEPTEMBER, nightsBooked: 8 });
      expect(done.body.lines.find((l: { bookingId: string }) => l.bookingId === pending.id)).toMatchObject({
        payoutPending: true,
        amountCents: 0,
      });
      const audit = await t.prisma.auditLog.findFirstOrThrow({ where: { action: 'statement.finalize' } });
      expect(audit).toMatchObject({ actorId: w.users.admin.id, entityId: s.id, propertyId: A });
      expect(audit.after).toMatchObject({
        status: 'FINALIZED',
        netCents: 50_340,
        confirmedPendingPayouts: [pending.id],
      });
    });

    it('stores the lines and totals, which no later change can alter', async () => {
      const s = await september();
      await admin().post(`/v1/statements/${s.id}/finalize`, {}).expect(200);
      expect(await t.prisma.ownerStatementLine.count({ where: { statementId: s.id } })).toBe(4);

      // The property's standard cleaning fee and plan change: the finalized copy doesn't.
      await t.prisma.property.update({ where: { id: A }, data: { standardCleaningFeeCents: 99_900 } });
      const res = await admin().get(`/v1/statements/${s.id}`).expect(200);
      expect(res.body).toMatchObject({ status: 'FINALIZED', totals: SEPTEMBER, calcVersion: 1, blockers: [] });
      expect(res.body.finalized.by.id).toBe(w.users.admin.id);
      expect(res.body.can).toEqual({ finalize: false, release: true, adjust: false, preview: true });

      const again = await admin().post(`/v1/statements/${s.id}/finalize`, {}).expect(409);
      expect(again.body.code).toBe('STATEMENT_NOT_DRAFT');
    });
  });

  describe('the lock on a finalized month', () => {
    let s: Awaited<ReturnType<typeof september>>;
    beforeEach(async () => {
      s = await september();
      await admin().post(`/v1/statements/${s.id}/finalize`, {}).expect(200);
    });

    const locked = (res: { status: number; body: { code: string; detail: string } }) => {
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('PERIOD_LOCKED');
      expect(res.body.detail).toMatch(/September 2026.*adjustment on the next month’s statement/);
    };

    it('refuses booking changes that feed the statement, and allows the rest', async () => {
      locked(await admin().patch(`/v1/bookings/${s.inside.id}`, { version: s.inside.version, payoutCents: 70_000 }));
      locked(
        await admin().patch(`/v1/bookings/${s.crossing.id}`, {
          version: s.crossing.version,
          checkOutDate: '2026-09-02',
        }),
      );
      locked(await admin().post(`/v1/bookings/${s.inside.id}/cancel`, { version: s.inside.version }));
      locked(
        await admin().post(`/v1/properties/${A}/bookings`, {
          channel: 'VRBO',
          checkInDate: '2026-09-24',
          checkOutDate: '2026-09-26',
        }),
      );
      // Moving an October stay into September is refused too.
      const oct = await booking({ checkInDate: '2026-10-10', checkOutDate: '2026-10-12' });
      locked(
        await admin().patch(`/v1/bookings/${oct.id}`, {
          version: oct.version,
          checkInDate: '2026-09-28',
          checkOutDate: '2026-09-30',
        }),
      );
      // Guest details and notes don't change the figures.
      await admin()
        .patch(`/v1/bookings/${s.inside.id}`, { version: s.inside.version, guestName: 'Corrected Name', notes: 'ok' })
        .expect(200);
      // October is still open, from its first night.
      await booking({ checkInDate: '2026-10-01', checkOutDate: '2026-10-03' });
    });

    it('refuses owner expense changes in the month, not TruHost’s own', async () => {
      locked(await admin().patch(`/v1/expenses/${s.supplies.id}`, { version: s.supplies.version, amountCents: 1 }));
      locked(await admin().post(`/v1/expenses/${s.supplies.id}/void`, { reason: 'Wrong' }));
      locked(
        await admin().post(`/v1/properties/${A}/expenses`, {
          category: 'SUPPLIES',
          description: 'Late receipt',
          incurredOn: '2026-09-30',
          amountCents: 500,
        }),
      );
      await admin()
        .post(`/v1/properties/${A}/expenses`, {
          category: 'OTHER',
          description: 'TruHost cost',
          bearer: 'TRUHOST',
          incurredOn: '2026-09-30',
          amountCents: 500,
        })
        .expect(201);
      // The description is just a label: still editable.
      await admin()
        .patch(`/v1/expenses/${s.supplies.id}`, { version: s.supplies.version, description: 'Restock (Costco)' })
        .expect(200);
    });

    it('refuses plan changes reaching the month', async () => {
      const other = await admin().post('/v1/plans', { name: 'Other', managementFeeBps: 1800 }).expect(201);
      const assign = await admin()
        .post(`/v1/properties/${A}/plan`, { planId: other.body.id, effectiveFrom: '2026-09-01' })
        .expect(409);
      expect(assign.body.code).toBe('PERIOD_LOCKED');
      await admin()
        .post(`/v1/properties/${A}/plan`, { planId: other.body.id, effectiveFrom: '2026-10-01' })
        .expect(200);
      const correct = await admin().post(`/v1/properties/${A}/plan/correct`, { planId: other.body.id }).expect(409);
      expect(correct.body.code).toBe('PERIOD_LOCKED');
    });

    it('is enforced by the database too', async () => {
      const raise = (sql: Promise<unknown>) => expect(sql).rejects.toThrow(/PERIOD_LOCKED/);
      await raise(t.prisma.$executeRaw`UPDATE "Booking" SET "payoutCents" = 1 WHERE id = ${s.inside.id}::uuid`);
      await raise(t.prisma.$executeRaw`DELETE FROM "Booking" WHERE id = ${s.inside.id}::uuid`);
      await raise(
        t.prisma.booking.create({
          data: {
            propertyId: A,
            source: 'MANUAL',
            channel: 'AIRBNB',
            checkInDate: new Date('2026-09-26T00:00:00Z'),
            checkOutDate: new Date('2026-09-27T00:00:00Z'),
          },
        }),
      );
      await raise(t.prisma.$executeRaw`UPDATE "Expense" SET "amountCents" = 1 WHERE id = ${s.supplies.id}::uuid`);
      // Allowed: fields that don't feed the statement.
      await t.prisma.$executeRaw`UPDATE "Booking" SET "guestName" = 'X' WHERE id = ${s.inside.id}::uuid`;
    });
  });

  describe('release', () => {
    it('records the payment, stores the PDF with its hash and makes the statement immutable', async () => {
      const s = await september();
      await admin().post(`/v1/statements/${s.id}/finalize`, {}).expect(200);
      const res = await admin()
        .post(`/v1/statements/${s.id}/release`, { releasedOn: '2026-10-05', paymentReference: 'ETF-88412' })
        .expect(200);
      expect(res.body).toMatchObject({
        status: 'RELEASED',
        totals: SEPTEMBER,
        released: { on: '2026-10-05', paymentReference: 'ETF-88412', by: { id: w.users.admin.id } },
        can: { finalize: false, release: false, adjust: false, preview: false },
      });

      const file = await t.prisma.storedFile.findUniqueOrThrow({ where: { id: res.body.pdf.fileId } });
      expect(file).toMatchObject({ purpose: 'STATEMENT_PDF', status: 'VERIFIED', contentType: 'application/pdf' });
      expect(res.body.pdf.sha256).toBe(file.sha256);
      expect(await storage.head(file.objectKey)).toMatchObject({ sizeBytes: file.sizeBytes, sha256Hex: file.sha256 });
      const url = await admin().get(`/v1/files/${file.id}/url`).expect(200);
      const link = new URL(url.body.url as string);
      const pdf = await t
        .http()
        .get(`${link.pathname}${link.search}`)
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(
        createHash('sha256')
          .update(pdf.body as Buffer)
          .digest('hex'),
      ).toBe(file.sha256);
      expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
      await t.as('ownerA').get(`/v1/files/${file.id}/url`).expect(404);

      for (const [path, body] of [
        ['release', { releasedOn: '2026-10-06' }],
        ['finalize', {}],
        ['adjustments', { amountCents: 100, reason: 'Too late' }],
      ] as const) {
        expect((await admin().post(`/v1/statements/${s.id}/${path}`, body)).status).toBe(409);
      }
      await admin().get(`/v1/statements/${s.id}/preview`).expect(409);

      const raise = (sql: Promise<unknown>) => expect(sql).rejects.toThrow();
      await raise(t.prisma.$executeRaw`UPDATE "OwnerStatement" SET "paymentReference" = 'X' WHERE id = ${s.id}::uuid`);
      await raise(t.prisma.$executeRaw`UPDATE "OwnerStatement" SET status = 'FINALIZED' WHERE id = ${s.id}::uuid`);
      await raise(t.prisma.$executeRaw`DELETE FROM "OwnerStatement" WHERE id = ${s.id}::uuid`);
      await raise(
        t.prisma.$executeRaw`UPDATE "OwnerStatementLine" SET "amountCents" = 0 WHERE "statementId" = ${s.id}::uuid`,
      );
      await raise(t.prisma.$executeRaw`DELETE FROM "OwnerStatementLine" WHERE "statementId" = ${s.id}::uuid`);

      expect(
        (await t.prisma.auditLog.findMany({ where: { entityId: s.id }, orderBy: { createdAt: 'asc' } })).map((a) => [
          a.action,
          a.actorId,
        ]),
      ).toEqual([
        ['statement.create', w.users.admin.id],
        ['statement.finalize', w.users.admin.id],
        ['statement.release', w.users.admin.id],
      ]);
      expect(t.email.sent).toEqual([]); // STATEMENT_EMAILS_ENABLED is off
    });

    it('checks the payment date and refuses a negative month', async () => {
      const s = await september();
      await admin().post(`/v1/statements/${s.id}/finalize`, {}).expect(200);
      const future = await admin().post(`/v1/statements/${s.id}/release`, { releasedOn: '2026-11-21' }).expect(422);
      expect(future.body.code).toBe('RELEASED_IN_FUTURE');
      const early = await admin().post(`/v1/statements/${s.id}/release`, { releasedOn: '2026-09-30' }).expect(422);
      expect(early.body.code).toBe('RELEASED_TOO_EARLY');

      // October: only the world's +$25 adjustment and an owner stay's $150 cleaning → net −$125.
      await booking({ kind: 'OWNER_STAY', checkInDate: '2026-10-08', checkOutDate: '2026-10-10' });
      const oct = await admin().post(`/v1/statements/${w.statements.draftA}/finalize`, {}).expect(200);
      expect(oct.body.totals.netCents).toBe(-12_500);
      expect(oct.body.can.release).toBe(false);
      const negative = await admin()
        .post(`/v1/statements/${w.statements.draftA}/release`, { releasedOn: '2026-11-05' })
        .expect(422);
      expect(negative.body.code).toBe('NEGATIVE_NET');
    });

    it('can’t happen before finalizing', async () => {
      const res = await admin().post(`/v1/statements/${w.statements.draftA}/release`, { releasedOn: '2026-11-05' });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('STATEMENT_NOT_FINALIZED');
    });
  });

  describe('adjustments', () => {
    it('carry a correction to the next month’s draft, linked to the month it corrects', async () => {
      const s = await september();
      await admin().post(`/v1/statements/${s.id}/finalize`, {}).expect(200);
      // A payout correction for September goes on October (the world's draft, which already has +$25).
      const res = await admin()
        .post(`/v1/statements/${w.statements.draftA}/adjustments`, {
          amountCents: 5_000,
          reason: 'Airbnb resolution payout for the Sep 10 stay',
          correctsStatementId: s.id,
        })
        .expect(200);
      expect(res.body.totals).toMatchObject({ adjustmentsCents: 7_500, netCents: 7_500 });
      expect(res.body.correctable).toEqual([{ id: s.id, month: '2026-09', status: 'FINALIZED' }]);
      const added = res.body.adjustments.find((a: { amountCents: number }) => a.amountCents === 5_000);
      expect(added).toMatchObject({ corrects: { id: s.id, month: '2026-09' }, createdBy: { id: w.users.admin.id } });
      expect(res.body.lines.at(-1)).toMatchObject({ kind: 'ADJUSTMENT', detail: 'Corrects September 2026' });

      // Not on a finalized statement, and only correcting an earlier, finalized one.
      const onFinal = await admin().post(`/v1/statements/${s.id}/adjustments`, { amountCents: 100, reason: 'No' });
      expect(onFinal.status).toBe(409);
      const nov = await admin().post(`/v1/properties/${A}/statements`, { month: '2026-11' }).expect(200);
      const forward = await admin().post(`/v1/statements/${w.statements.draftA}/adjustments`, {
        amountCents: 100,
        reason: 'Corrects a later month',
        correctsStatementId: nov.body.id,
      });
      expect(forward.status).toBe(422);
      await admin()
        .post(`/v1/statements/${w.statements.draftA}/adjustments`, { amountCents: 0, reason: 'Zero' })
        .expect(400);
      await admin().post(`/v1/statements/${w.statements.draftA}/adjustments`, { amountCents: 100 }).expect(400);

      // Voided while a draft: excluded from the figures, kept in the list.
      const voided = await admin()
        .post(`/v1/adjustments/${w.statements.adjustmentA}/void`, { reason: 'Entered twice' })
        .expect(200);
      expect(voided.body.totals.adjustmentsCents).toBe(5_000);
      expect(voided.body.adjustments.find((a: { id: string }) => a.id === w.statements.adjustmentA)).toMatchObject({
        voidReason: 'Entered twice',
      });
      await admin().post(`/v1/adjustments/${w.statements.adjustmentA}/void`, { reason: 'Again' }).expect(409);

      // Finalizing October freezes its adjustments.
      const oct = await admin().post(`/v1/statements/${w.statements.draftA}/finalize`, {}).expect(200);
      expect(oct.body.totals).toMatchObject({ adjustmentsCents: 5_000, netCents: 5_000 });
      await admin().post(`/v1/adjustments/${added.id}/void`, { reason: 'Too late' }).expect(409);
      await expect(
        t.prisma.$executeRaw`UPDATE "StatementAdjustment" SET "amountCents" = 1 WHERE id = ${added.id}::uuid`,
      ).rejects.toThrow();
      await expect(
        t.prisma.statementAdjustment.create({
          data: {
            propertyId: A,
            statementId: w.statements.draftA,
            amountCents: 1,
            reason: 'Sneaked in',
            createdById: w.users.admin.id,
          },
        }),
      ).rejects.toThrow();

      expect(await t.prisma.auditLog.count({ where: { action: 'statementAdjustment.create' } })).toBe(1);
      expect(await t.prisma.auditLog.count({ where: { action: 'statementAdjustment.void' } })).toBe(1);
    });

    it('need a reason and are never deleted', async () => {
      await expect(
        t.prisma
          .$executeRaw`UPDATE "StatementAdjustment" SET reason = '  ' WHERE id = ${w.statements.adjustmentA}::uuid`,
      ).rejects.toThrow();
      await expect(
        t.prisma.$executeRaw`DELETE FROM "StatementAdjustment" WHERE id = ${w.statements.adjustmentA}::uuid`,
      ).rejects.toThrow();
    });
  });

  describe('PDF preview', () => {
    it('renders a draft or finalized statement as a PDF', async () => {
      const s = await september();
      const res = await admin()
        .get(`/v1/statements/${s.id}/preview`)
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toContain('TruHost-statement-Property-A-2026-09.pdf');
      expect((res.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    });
  });
});

describe('owner statements: release email (STATEMENT_EMAILS_ENABLED=true)', () => {
  let t: TestApp;
  let w: World;

  beforeAll(async () => {
    process.env.STATEMENT_EMAILS_ENABLED = 'true';
    t = await createTestApp();
  });
  afterAll(async () => {
    delete process.env.STATEMENT_EMAILS_ENABLED;
    await t.close();
  });
  beforeEach(async () => {
    await resetDb(t.prisma);
    t.email.reset();
    w = await seedWorld(t.prisma);
  });

  it('emails the property’s owners the net and a link, unless they turned it off', async () => {
    // B's December 2025 is finalized (net $0). Owner B keeps the default (on); a second owner turns email off.
    const quiet = await t.prisma.user.create({
      data: { email: 'quiet@example.test', firstName: 'Quiet', lastName: 'Owner', status: 'ACTIVE' },
    });
    await t.prisma.membership.create({ data: { userId: quiet.id, propertyId: w.propertyB.id, role: 'OWNER' } });
    await t.prisma.notificationSetting.create({
      data: { userId: quiet.id, category: 'STATEMENT_RELEASED', email: false, inApp: true },
    });
    await t
      .as('admin')
      .post(`/v1/statements/${w.statements.finalizedB}/release`, { releasedOn: '2026-01-05' })
      .expect(200);
    expect(t.email.sent.map((m) => m.to)).toEqual(['ownerb@example.test']);
    const [m] = t.email.sent;
    expect(m!.subject).toBe('Your December 2025 statement for Property B');
    expect(m!.text).toContain('We sent you $0.00 on Jan 5, 2026.');
    expect(m!.text).toContain(
      `https://app.truhost.example/properties/${w.propertyB.id}/statements/${w.statements.finalizedB}`,
    );
  });
});
