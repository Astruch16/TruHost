import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  NOTIFICATION_CATALOGUE,
  type CreateAdjustment,
  type FinalizeStatement,
  type ReleaseStatement,
  type Statement,
  type StatementBlocker,
  type StatementMonth,
  type StatementRow,
  type StatementState,
} from '@truhost/shared';
import { AccessService } from '../access/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { Actor } from '../auth/actor.js';
import { CLOCK, type Clock } from '../common/clock.js';
import { currentMonthStart, fromIsoDate, toIsoDate, todayIn } from '../common/dates.js';
import { conflict, notFound, unprocessable } from '../common/problem.js';
import { uuidv7 } from '../common/uuid.js';
import { ENV, type Env } from '../config/env.js';
import { EMAIL_SENDER, type EmailSender } from '../email/email-sender.js';
import { statementReleasedEmail } from '../email/templates.js';
import { FILE_STORAGE, type FileStorage } from '../files/storage.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { formatCad, formatDate } from '../reporting/format.js';
import { monthBounds } from '../reporting/monthly.js';
import {
  computeStatement,
  monthName,
  STATEMENT_CALC_VERSION,
  type ComputedStatement,
  type StatementLine,
  type StatementTotals,
} from '../reporting/statement.js';
import { renderStatementPdf, type StatementDocument } from './statement-pdf.js';

type Db = Tx | PrismaService;

const PERSON = { select: { id: true, firstName: true, lastName: true } } as const;
const RECEIPTS = {
  where: { voidedAt: null },
  include: { file: { select: { originalFilename: true, contentType: true } } },
  orderBy: { createdAt: 'asc' },
} as const;
const STATEMENT_INCLUDE = {
  property: true,
  createdBy: PERSON,
  finalizedBy: PERSON,
  releasedBy: PERSON,
  pdfFile: { select: { id: true, sha256: true, sizeBytes: true } },
  lines: { orderBy: { sortOrder: 'asc' } },
  adjustments: {
    include: { createdBy: PERSON, correctsStatement: { select: { id: true, periodMonth: true } } },
    orderBy: { createdAt: 'asc' },
  },
} as const;
type StatementRecord = Prisma.OwnerStatementGetPayload<{ include: typeof STATEMENT_INCLUDE }>;
type ReceiptRow = Prisma.ReceiptGetPayload<{ include: (typeof RECEIPTS)['include'] }>;
type PropertyRecord = StatementRecord['property'];

/** A property's month as it stands now: the live calculation and what blocks finalizing it. */
interface LiveMonth {
  computed: ComputedStatement;
  plan: { name: string; managementFeeBps: number } | null;
  blockers: StatementBlocker[];
  /** Admin detail the calculation doesn't need: guest names and receipts, by record id. */
  guests: Map<string, { guestName: string | null; checkIn: string; checkOut: string; channel: string }>;
  receipts: Map<string, ReceiptRow[]>;
}

const monthOf = (d: Date) => toIsoDate(d).slice(0, 7);
const statementMonthDate = (month: string) => fromIsoDate(`${month}-01`);

/**
 * Owner statements (docs/spec.md §4): drafts computed live, finalize (copy and lock), release (paid, PDF stored), and
 * adjustments. Every figure comes from reporting/statement.ts; this service loads records, enforces the lifecycle and
 * writes the audit log in the same transaction as each change.
 */
@Injectable()
export class StatementsService {
  private readonly logger = new Logger(StatementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
    @Inject(ENV) private readonly env: Env,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  // ── Reads ──

  /** Every property's statement for a month: one row each, with its state and net. */
  async month(actor: Actor, month: string): Promise<StatementMonth> {
    this.access.assert(actor, 'statement:read');
    const periodMonth = statementMonthDate(month);
    const statements = await this.prisma.ownerStatement.findMany({ where: { periodMonth } });
    const properties = await this.prisma.property.findMany({
      where: { OR: [{ archivedAt: null }, { id: { in: statements.map((s) => s.propertyId) } }] },
      orderBy: { name: 'asc' },
    });
    const items: StatementRow[] = [];
    for (const property of properties) {
      const st = statements.find((s) => s.propertyId === property.id) ?? null;
      const state: StatementState = st ? st.status : 'NOT_STARTED';
      const base = {
        property: { id: property.id, name: property.name, archived: property.archivedAt !== null },
        statementId: st?.id ?? null,
        state,
        finalizedAt: st?.finalizedAt?.toISOString() ?? null,
        releasedOn: st?.releasedOn ? toIsoDate(st.releasedOn) : null,
      };
      if (st && st.status !== 'DRAFT') {
        items.push({
          ...base,
          nightsBooked: st.nightsBooked!,
          grossCents: st.grossCents!,
          netCents: st.netCents!,
          blockers: 0,
          pendingPayouts: 0,
        });
        continue;
      }
      const live = await this.live(this.prisma, property, month, st?.id ?? null);
      items.push({
        ...base,
        nightsBooked: live.computed.totals.nightsBooked,
        grossCents: live.computed.totals.grossCents,
        netCents: live.computed.totals.netCents,
        blockers: live.blockers.length,
        pendingPayouts: live.computed.pendingPayoutBookingIds.length,
      });
    }
    const sum = (rows: StatementRow[]) => rows.reduce((acc, r) => acc + r.netCents, 0);
    const count = (state: StatementState) => items.filter((i) => i.state === state).length;
    return {
      month,
      items,
      totals: {
        netCents: sum(items),
        toReleaseCents: sum(items.filter((i) => i.state === 'FINALIZED')),
        releasedCents: sum(items.filter((i) => i.state === 'RELEASED')),
        counts: {
          NOT_STARTED: count('NOT_STARTED'),
          DRAFT: count('DRAFT'),
          FINALIZED: count('FINALIZED'),
          RELEASED: count('RELEASED'),
        },
      },
    };
  }

  async listForProperty(actor: Actor, propertyId: string) {
    this.access.assert(actor, 'statement:read', propertyId, 'Property');
    if (!(await this.prisma.property.count({ where: { id: propertyId } }))) throw notFound('Property');
    const rows = await this.prisma.ownerStatement.findMany({
      where: { propertyId },
      include: { property: true },
      orderBy: { periodMonth: 'desc' },
    });
    const items = [];
    for (const st of rows) {
      const month = monthOf(st.periodMonth);
      const netCents =
        st.status === 'DRAFT'
          ? (await this.live(this.prisma, st.property, month, st.id)).computed.totals.netCents
          : st.netCents!;
      items.push({
        id: st.id,
        month,
        status: st.status,
        netCents,
        finalizedAt: st.finalizedAt?.toISOString() ?? null,
        releasedOn: st.releasedOn ? toIsoDate(st.releasedOn) : null,
      });
    }
    return { items };
  }

  async get(actor: Actor, id: string): Promise<Statement> {
    const st = await this.find(this.prisma, actor, id);
    return this.present(this.prisma, st);
  }

  /** The PDF as it would print now: a draft's live figures, or a finalized statement's copy (marked as a preview). */
  async previewPdf(actor: Actor, id: string): Promise<{ filename: string; body: Buffer }> {
    const st = await this.find(this.prisma, actor, id, 'statement:manage');
    if (st.status === 'RELEASED') {
      throw conflict('STATEMENT_RELEASED', 'This statement is released: open its stored PDF instead.');
    }
    const view = await this.present(this.prisma, st);
    return { filename: this.pdfFilename(st), body: await renderStatementPdf(this.document(st, view)) };
  }

  // ── Drafts ──

  /** Starts the draft for a property and month (idempotent: an existing statement is returned as it is). */
  async create(actor: Actor, propertyId: string, month: string): Promise<Statement> {
    this.access.assert(actor, 'statement:manage', propertyId, 'Property');
    const id = await this.prisma.$transaction(async (tx) => {
      const property = await tx.property.findUnique({ where: { id: propertyId } });
      if (!property) throw notFound('Property');
      return (await this.ensureDraft(tx, actor, property, month, { strict: true }))!;
    });
    return this.get(actor, id);
  }

  /** Starts a draft for every active property that has none for the month yet. */
  async generate(actor: Actor, month: string) {
    this.access.assert(actor, 'statement:manage');
    const properties = await this.prisma.property.findMany({ where: { archivedAt: null }, orderBy: { name: 'asc' } });
    let created = 0;
    for (const property of properties) {
      const made = await this.prisma.$transaction((tx) =>
        this.ensureDraft(tx, actor, property, month, { strict: false, countOnly: true }),
      );
      if (made) created += 1;
    }
    return { ...(await this.month(actor, month)), created };
  }

  /**
   * Creates the draft unless the property already has a statement for the month. Refuses (strict) or skips months in
   * the future and months before a finalized one (statements are finalized in order, assumption A14). Returns the
   * statement id (with `countOnly`, only when it was created here).
   */
  private async ensureDraft(
    tx: Tx,
    actor: Actor,
    property: { id: string; timeZone: string },
    month: string,
    o: { strict: boolean; countOnly?: boolean },
  ): Promise<string | null> {
    const periodMonth = statementMonthDate(month);
    await tx.$queryRaw`SELECT id FROM "Property" WHERE id = ${property.id}::uuid FOR UPDATE`;
    const existing = await tx.ownerStatement.findUnique({
      where: { propertyId_periodMonth: { propertyId: property.id, periodMonth } },
    });
    if (existing) return o.countOnly ? null : existing.id;

    if (`${month}-01` > currentMonthStart(property.timeZone, this.clock.now())) {
      if (!o.strict) return null;
      throw unprocessable('MONTH_IN_FUTURE', `${monthName(month)} hasn’t started yet.`);
    }
    const later = await tx.ownerStatement.findFirst({
      where: { propertyId: property.id, status: { not: 'DRAFT' }, periodMonth: { gt: periodMonth } },
      orderBy: { periodMonth: 'asc' },
    });
    if (later) {
      if (!o.strict) return null;
      throw conflict(
        'STATEMENT_OUT_OF_ORDER',
        `${monthName(monthOf(later.periodMonth))} is already finalized for this property, and months are finalized in order.`,
      );
    }
    const created = await tx.ownerStatement.create({
      data: { propertyId: property.id, periodMonth, createdById: actor.userId },
    });
    await this.audit.record(tx, actor, {
      action: 'statement.create',
      entityType: 'OwnerStatement',
      entityId: created.id,
      propertyId: property.id,
      after: { month, status: 'DRAFT' },
    });
    return created.id;
  }

  // ── Adjustments ──

  async addAdjustment(actor: Actor, statementId: string, input: Required<CreateAdjustment>): Promise<Statement> {
    const st = await this.find(this.prisma, actor, statementId, 'statement:manage');
    await this.prisma.$transaction(async (tx) => {
      if (st.status !== 'DRAFT') throw notDraft(monthOf(st.periodMonth));
      if (input.correctsStatementId) {
        const target = await tx.ownerStatement.findUnique({ where: { id: input.correctsStatementId } });
        if (
          !target ||
          target.propertyId !== st.propertyId ||
          target.status === 'DRAFT' ||
          target.periodMonth >= st.periodMonth
        ) {
          throw unprocessable(
            'UNKNOWN_STATEMENT',
            'An adjustment can only correct an earlier, finalized statement of this property.',
          );
        }
      }
      const row = await tx.statementAdjustment.create({
        data: {
          propertyId: st.propertyId,
          statementId: st.id,
          amountCents: input.amountCents,
          reason: input.reason,
          correctsStatementId: input.correctsStatementId,
          createdById: actor.userId,
        },
      });
      await this.audit.record(tx, actor, {
        action: 'statementAdjustment.create',
        entityType: 'StatementAdjustment',
        entityId: row.id,
        propertyId: st.propertyId,
        after: {
          statementId: st.id,
          month: monthOf(st.periodMonth),
          amountCents: input.amountCents,
          reason: input.reason,
          correctsStatementId: input.correctsStatementId,
        },
      });
    });
    return this.get(actor, statementId);
  }

  async voidAdjustment(actor: Actor, adjustmentId: string, reason: string): Promise<Statement> {
    const adjustment = await this.prisma.statementAdjustment.findUnique({
      where: { id: adjustmentId },
      include: { statement: true },
    });
    if (!adjustment || !this.access.can(actor, 'statement:manage', adjustment.propertyId)) {
      throw notFound('Adjustment');
    }
    await this.prisma.$transaction(async (tx) => {
      if (adjustment.statement.status !== 'DRAFT') throw notDraft(monthOf(adjustment.statement.periodMonth));
      const { count } = await tx.statementAdjustment.updateMany({
        where: { id: adjustmentId, voidedAt: null },
        data: { voidedAt: this.clock.now(), voidedById: actor.userId, voidReason: reason },
      });
      if (count !== 1) throw conflict('ADJUSTMENT_VOIDED', 'This adjustment is already voided.');
      await this.audit.record(tx, actor, {
        action: 'statementAdjustment.void',
        entityType: 'StatementAdjustment',
        entityId: adjustmentId,
        propertyId: adjustment.propertyId,
        before: { amountCents: adjustment.amountCents, reason: adjustment.reason },
        after: { voidReason: reason },
      });
    });
    return this.get(actor, adjustment.statementId);
  }

  // ── Finalize and release ──

  /**
   * Copies the draft's lines and totals into the statement and locks the month. Refused (422) while anything blocks
   * it; stays still waiting on their payout need `confirmPendingPayouts` (409 otherwise), and are copied at $0.
   */
  async finalize(actor: Actor, id: string, input: Required<FinalizeStatement>): Promise<Statement> {
    const found = await this.find(this.prisma, actor, id, 'statement:manage');
    await this.prisma.$transaction(async (tx) => {
      // Lock order: the property (period-lock writers share-lock it), then the statement (adjustments share-lock it).
      // Everything read below sees every change that committed before us, and nothing can change it until we commit.
      await tx.$queryRaw`SELECT id FROM "Property" WHERE id = ${found.propertyId}::uuid FOR NO KEY UPDATE`;
      await tx.$queryRaw`SELECT id FROM "OwnerStatement" WHERE id = ${id}::uuid FOR UPDATE`;
      const st = await tx.ownerStatement.findUniqueOrThrow({ where: { id }, include: { property: true } });
      const month = monthOf(st.periodMonth);
      if (st.status !== 'DRAFT') throw conflict('STATEMENT_NOT_DRAFT', `${monthName(month)} is already finalized.`);

      const live = await this.live(tx, st.property, month, st.id);
      if (live.blockers.length > 0) {
        throw unprocessable('STATEMENT_BLOCKED', 'This statement can’t be finalized yet.', {
          blockers: live.blockers,
        });
      }
      const pending = live.computed.pendingPayoutBookingIds;
      if (pending.length > 0 && !input.confirmPendingPayouts) {
        throw conflict(
          'PAYOUTS_PENDING',
          `${pending.length === 1 ? 'One stay is' : `${pending.length} stays are`} still waiting on a payout. Confirm to finalize with ${pending.length === 1 ? 'it' : 'them'} at $0; a payout that arrives later goes on a later statement as an adjustment.`,
          { bookingIds: pending },
        );
      }

      const { totals, lines } = live.computed;
      await tx.ownerStatementLine.createMany({
        data: lines.map((l, sortOrder) => ({
          statementId: st.id,
          kind: l.kind,
          bookingId: l.bookingId,
          expenseId: l.expenseId,
          adjustmentId: l.adjustmentId,
          date: fromIsoDate(l.date),
          endDate: l.endDate ? fromIsoDate(l.endDate) : null,
          channel: l.channel,
          category: l.category,
          description: l.description,
          detail: l.detail,
          nights: l.nights,
          totalNights: l.totalNights,
          stayGrossCents: l.stayGrossCents,
          cancelled: l.cancelled,
          payoutPending: l.payoutPending,
          amountCents: l.amountCents,
          sortOrder,
        })),
      });
      const now = this.clock.now();
      const { count } = await tx.ownerStatement.updateMany({
        where: { id: st.id, status: 'DRAFT' },
        data: {
          status: 'FINALIZED',
          managementFeeBps: totals.managementFeeBps!,
          planName: live.plan!.name,
          nightsBooked: totals.nightsBooked,
          grossCents: totals.grossCents,
          managementFeeCents: totals.managementFeeCents,
          expensesCents: totals.expensesCents,
          ownerStayCleaningCents: totals.ownerStayCleaningCents,
          adjustmentsCents: totals.adjustmentsCents,
          netCents: totals.netCents,
          calcVersion: STATEMENT_CALC_VERSION,
          finalizedAt: now,
          finalizedById: actor.userId,
        },
      });
      if (count !== 1) throw conflict('STATEMENT_NOT_DRAFT', `${monthName(month)} is already finalized.`);
      await this.audit.record(tx, actor, {
        action: 'statement.finalize',
        entityType: 'OwnerStatement',
        entityId: st.id,
        propertyId: st.propertyId,
        before: { status: 'DRAFT' },
        after: {
          status: 'FINALIZED',
          month,
          ...totals,
          lines: lines.length,
          ...(pending.length > 0 ? { confirmedPendingPayouts: pending } : {}),
        },
      });
    });
    return this.get(actor, id);
  }

  /**
   * Records that the owner was paid, renders the PDF from the finalized copy, stores it (with its SHA-256) and marks
   * the statement RELEASED. Nothing about it changes after this. Emails the owners when STATEMENT_EMAILS_ENABLED.
   */
  async release(actor: Actor, id: string, input: Required<ReleaseStatement>): Promise<Statement> {
    const st = await this.find(this.prisma, actor, id, 'statement:manage');
    const month = monthOf(st.periodMonth);
    if (st.status === 'DRAFT')
      throw conflict('STATEMENT_NOT_FINALIZED', 'Finalize this statement before releasing it.');
    if (st.status === 'RELEASED') throw conflict('STATEMENT_RELEASED', `${monthName(month)} is already released.`);
    if (st.netCents! < 0) {
      throw unprocessable(
        'NEGATIVE_NET',
        'This month’s expenses are more than its revenue, so there is nothing to pay out. Carry the balance to next month as an adjustment.',
      );
    }
    const today = todayIn(st.property.timeZone, this.clock.now());
    if (input.releasedOn > today) throw unprocessable('RELEASED_IN_FUTURE', 'The payment date can’t be in the future.');
    if (input.releasedOn < monthBounds(month).next) {
      throw unprocessable('RELEASED_TOO_EARLY', `The payment date must be after ${monthName(month)} ended.`);
    }

    const now = this.clock.now();
    const view = await this.present(this.prisma, st);
    const body = await renderStatementPdf(
      this.document(st, view, { on: input.releasedOn, paymentReference: input.paymentReference }, now),
    );
    const sha256 = createHash('sha256').update(body).digest('hex');
    const fileId = uuidv7();
    const objectKey = `properties/${st.propertyId}/statement_pdf/${fileId}`;
    await this.storage.put(objectKey, body, { contentType: 'application/pdf', sha256Hex: sha256 });

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.storedFile.create({
          data: {
            id: fileId,
            purpose: 'STATEMENT_PDF',
            propertyId: st.propertyId,
            objectKey,
            contentType: 'application/pdf',
            sizeBytes: body.length,
            sha256,
            status: 'VERIFIED',
            verifiedAt: now,
            uploadedById: actor.userId,
            originalFilename: this.pdfFilename(st),
          },
        });
        const { count } = await tx.ownerStatement.updateMany({
          where: { id, status: 'FINALIZED' },
          data: {
            status: 'RELEASED',
            releasedOn: fromIsoDate(input.releasedOn),
            releasedAt: now,
            releasedById: actor.userId,
            paymentReference: input.paymentReference,
            pdfFileId: fileId,
          },
        });
        if (count !== 1) throw conflict('STATEMENT_RELEASED', `${monthName(month)} is already released.`);
        await this.audit.record(tx, actor, {
          action: 'statement.release',
          entityType: 'OwnerStatement',
          entityId: id,
          propertyId: st.propertyId,
          before: { status: 'FINALIZED' },
          after: {
            status: 'RELEASED',
            month,
            releasedOn: input.releasedOn,
            paymentReference: input.paymentReference,
            netCents: st.netCents,
            pdf: { fileId, sha256, sizeBytes: body.length },
          },
        });
      });
    } catch (e) {
      // Nothing points at the object: remove it (best effort) so a retry starts clean.
      await this.storage.delete(objectKey).catch(() => undefined);
      throw e;
    }

    if (this.env.STATEMENT_EMAILS_ENABLED) await this.emailOwners(st, input.releasedOn);
    return this.get(actor, id);
  }

  // ── helpers ──

  private async find(
    db: Db,
    actor: Actor,
    id: string,
    action: 'statement:read' | 'statement:manage' = 'statement:read',
  ) {
    const st = await db.ownerStatement.findUnique({ where: { id }, include: STATEMENT_INCLUDE });
    if (!st || !this.access.can(actor, action, st.propertyId)) throw notFound('Statement');
    return st;
  }

  /**
   * Loads a property's records for the month and runs the calculation. `statementId` is the draft (its adjustments
   * count); null when no draft exists yet.
   */
  private async live(db: Db, property: PropertyRecord, month: string, statementId: string | null): Promise<LiveMonth> {
    const { first, next } = monthBounds(month);
    const firstDate = fromIsoDate(first);
    const nextDate = fromIsoDate(next);
    const [bookings, expenses, planRow, adjustments, earlierDraft] = await Promise.all([
      db.booking.findMany({
        where: { propertyId: property.id, checkInDate: { lt: nextDate }, checkOutDate: { gte: firstDate } },
        orderBy: [{ checkInDate: 'asc' }, { id: 'asc' }],
      }),
      db.expense.findMany({
        where: { propertyId: property.id, incurredOn: { gte: firstDate, lt: nextDate } },
        include: { receipts: RECEIPTS },
        orderBy: [{ incurredOn: 'asc' }, { id: 'asc' }],
      }),
      db.propertyPlan.findFirst({
        where: {
          propertyId: property.id,
          effectiveFrom: { lte: firstDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: firstDate } }],
        },
        include: { plan: true },
      }),
      statementId
        ? db.statementAdjustment.findMany({
            where: { statementId, voidedAt: null },
            include: { correctsStatement: { select: { periodMonth: true } } },
          })
        : Promise.resolve([]),
      db.ownerStatement.findFirst({
        where: { propertyId: property.id, status: 'DRAFT', periodMonth: { lt: firstDate } },
        orderBy: { periodMonth: 'asc' },
      }),
    ]);

    const computed = computeStatement({
      month,
      feeBps: planRow?.plan.managementFeeBps ?? null,
      ownerStayCleaningFeeCents: property.standardCleaningFeeCents,
      bookings: bookings.map((b) => ({
        id: b.id,
        kind: b.kind,
        status: b.status,
        channel: b.channel,
        checkIn: toIsoDate(b.checkInDate),
        checkOut: toIsoDate(b.checkOutDate),
        payoutCents: b.payoutCents,
        guestCleaningFeeCents: b.guestCleaningFeeCents,
      })),
      expenses: expenses.map((e) => ({
        id: e.id,
        amountCents: e.amountCents,
        bearer: e.bearer,
        voided: e.voidedAt !== null,
        incurredOn: toIsoDate(e.incurredOn),
        hasReceipt: e.receipts.length > 0,
        category: e.category,
        description: e.description,
        vendor: e.vendor,
      })),
      adjustments: adjustments.map((a) => ({
        id: a.id,
        amountCents: a.amountCents,
        reason: a.reason,
        addedOn: todayIn(property.timeZone, a.createdAt),
        correctsMonth: a.correctsStatement ? monthOf(a.correctsStatement.periodMonth) : null,
      })),
    });

    const blockers: StatementBlocker[] = [];
    if (todayIn(property.timeZone, this.clock.now()) < next) {
      blockers.push({ code: 'MONTH_NOT_OVER', message: `${monthName(month)} isn’t over yet.` });
    }
    if (earlierDraft) {
      blockers.push({
        code: 'EARLIER_DRAFT',
        message: `Finalize ${monthName(monthOf(earlierDraft.periodMonth))} first: months are finalized in order.`,
        statementId: earlierDraft.id,
      });
    }
    if (!planRow) {
      blockers.push({ code: 'NO_PLAN', message: `No plan is in force for ${monthName(month)}. Assign one first.` });
    }
    const missing = computed.expensesMissingReceiptIds;
    if (missing.length > 0) {
      blockers.push({
        code: 'MISSING_RECEIPTS',
        message: `${missing.length === 1 ? 'One expense needs' : `${missing.length} expenses need`} a receipt.`,
        expenseIds: missing,
      });
    }

    return {
      computed,
      plan: planRow ? { name: planRow.plan.name, managementFeeBps: planRow.plan.managementFeeBps } : null,
      blockers,
      guests: new Map(
        bookings.map((b) => [
          b.id,
          {
            guestName: b.guestName,
            checkIn: toIsoDate(b.checkInDate),
            checkOut: toIsoDate(b.checkOutDate),
            channel: b.channel,
          },
        ]),
      ),
      receipts: new Map(expenses.map((e) => [e.id, e.receipts])),
    };
  }

  /** The API response: live figures for a draft, the stored copy otherwise. */
  private async present(db: Db, st: StatementRecord): Promise<Statement> {
    const month = monthOf(st.periodMonth);
    const owners = await db.membership.findMany({
      where: { propertyId: st.propertyId, role: 'OWNER', revokedAt: null, user: { status: { not: 'DEACTIVATED' } } },
      include: { user: PERSON },
      orderBy: { createdAt: 'asc' },
    });
    const correctable = await db.ownerStatement.findMany({
      where: { propertyId: st.propertyId, status: { not: 'DRAFT' }, periodMonth: { lt: st.periodMonth } },
      orderBy: { periodMonth: 'desc' },
      take: 24,
      select: { id: true, periodMonth: true, status: true },
    });

    let totals: StatementTotals;
    let lines: StatementLine[];
    let plan: Statement['plan'];
    let blockers: StatementBlocker[] = [];
    let pendingPayouts: Statement['pendingPayouts'] = [];
    let guestName = (_id: string | null): string | null => null;
    let receipts: Map<string, ReceiptRow[]>;

    if (st.status === 'DRAFT') {
      const live = await this.live(db, st.property, month, st.id);
      ({ totals, lines } = live.computed);
      plan = live.plan;
      blockers = live.blockers;
      pendingPayouts = live.computed.pendingPayoutBookingIds.map((bookingId) => {
        const g = live.guests.get(bookingId)!;
        return {
          bookingId,
          checkInDate: g.checkIn,
          checkOutDate: g.checkOut,
          channel: g.channel as Statement['pendingPayouts'][number]['channel'],
          guestName: g.guestName,
        };
      });
      guestName = (bookingId) => (bookingId ? (live.guests.get(bookingId)?.guestName ?? null) : null);
      receipts = live.receipts;
    } else {
      totals = {
        nightsBooked: st.nightsBooked!,
        grossCents: st.grossCents!,
        managementFeeBps: st.managementFeeBps!,
        managementFeeCents: st.managementFeeCents!,
        expensesCents: st.expensesCents!,
        ownerStayCleaningCents: st.ownerStayCleaningCents!,
        adjustmentsCents: st.adjustmentsCents!,
        netCents: st.netCents!,
      };
      lines = st.lines.map((l) => ({
        kind: l.kind,
        bookingId: l.bookingId,
        expenseId: l.expenseId,
        adjustmentId: l.adjustmentId,
        date: toIsoDate(l.date),
        endDate: l.endDate ? toIsoDate(l.endDate) : null,
        channel: l.channel,
        category: l.category,
        description: l.description,
        detail: l.detail,
        nights: l.nights,
        totalNights: l.totalNights,
        stayGrossCents: l.stayGrossCents,
        cancelled: l.cancelled,
        payoutPending: l.payoutPending,
        amountCents: l.amountCents,
      }));
      plan = { name: st.planName!, managementFeeBps: st.managementFeeBps! };
      const bookingIds = lines.flatMap((l) => (l.bookingId ? [l.bookingId] : []));
      const guests = new Map(
        (await db.booking.findMany({ where: { id: { in: bookingIds } }, select: { id: true, guestName: true } })).map(
          (b) => [b.id, b.guestName],
        ),
      );
      guestName = (bookingId) => (bookingId ? (guests.get(bookingId) ?? null) : null);
      const expenseIds = lines.flatMap((l) => (l.expenseId ? [l.expenseId] : []));
      receipts = new Map(
        (await db.expense.findMany({ where: { id: { in: expenseIds } }, include: { receipts: RECEIPTS } })).map((e) => [
          e.id,
          e.receipts,
        ]),
      );
    }

    const person = (p: { id: string; firstName: string; lastName: string }) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
    });

    return {
      id: st.id,
      property: { id: st.property.id, name: st.property.name, archived: st.property.archivedAt !== null },
      owners: owners.map((m) => person(m.user)),
      month,
      status: st.status,
      plan,
      totals,
      lines: lines.map((l) => ({
        ...l,
        ...(l.kind === 'STAY' ? { guestName: guestName(l.bookingId) } : {}),
        ...(l.expenseId
          ? {
              receipts: (receipts.get(l.expenseId) ?? []).map((r) => ({
                id: r.id,
                fileId: r.fileId,
                receiptDate: toIsoDate(r.receiptDate),
                description: r.description,
                filename: r.file.originalFilename,
                contentType: r.file.contentType,
              })),
            }
          : {}),
      })),
      adjustments: st.adjustments.map((a) => ({
        id: a.id,
        amountCents: a.amountCents,
        reason: a.reason,
        corrects: a.correctsStatement
          ? { id: a.correctsStatement.id, month: monthOf(a.correctsStatement.periodMonth) }
          : null,
        createdAt: a.createdAt.toISOString(),
        createdBy: person(a.createdBy),
        voidedAt: a.voidedAt?.toISOString() ?? null,
        voidReason: a.voidReason,
      })),
      blockers,
      pendingPayouts,
      correctable: correctable.map((c) => ({ id: c.id, month: monthOf(c.periodMonth), status: c.status })),
      created: { at: st.createdAt.toISOString(), by: person(st.createdBy) },
      finalized:
        st.finalizedAt && st.finalizedBy ? { at: st.finalizedAt.toISOString(), by: person(st.finalizedBy) } : null,
      released:
        st.releasedOn && st.releasedAt && st.releasedBy
          ? {
              on: toIsoDate(st.releasedOn),
              at: st.releasedAt.toISOString(),
              by: person(st.releasedBy),
              paymentReference: st.paymentReference,
            }
          : null,
      pdf: st.pdfFile ? { fileId: st.pdfFile.id, sha256: st.pdfFile.sha256, sizeBytes: st.pdfFile.sizeBytes } : null,
      calcVersion: st.calcVersion,
      can: {
        finalize: st.status === 'DRAFT' && blockers.length === 0,
        release: st.status === 'FINALIZED' && totals.netCents >= 0,
        adjust: st.status === 'DRAFT',
        preview: st.status !== 'RELEASED',
      },
    };
  }

  private document(
    st: StatementRecord,
    view: Statement,
    released: StatementDocument['released'] = view.released
      ? { on: view.released.on, paymentReference: view.released.paymentReference }
      : null,
    generatedAt = this.clock.now(),
  ): StatementDocument {
    const p = st.property;
    return {
      statementId: st.id,
      status: released ? 'RELEASED' : st.status,
      property: {
        name: p.name,
        address: [p.addressLine1, p.addressLine2, `${p.city}, ${p.province} ${p.postalCode}`].filter((l): l is string =>
          Boolean(l),
        ),
      },
      owners: view.owners.map((o) => `${o.firstName} ${o.lastName}`.trim()),
      month: view.month,
      plan: view.plan,
      totals: view.totals,
      lines: view.lines,
      released,
      generatedAt,
    };
  }

  private pdfFilename(st: StatementRecord) {
    const name = st.property.name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `TruHost-statement-${name}-${monthOf(st.periodMonth)}.pdf`;
  }

  /** After commit, best effort: each active owner whose "Monthly statement ready" email setting is on. */
  private async emailOwners(st: StatementRecord, releasedOn: string) {
    const month = monthOf(st.periodMonth);
    const defaults = NOTIFICATION_CATALOGUE.find((c) => c.category === 'STATEMENT_RELEASED')!.defaults;
    const owners = await this.prisma.membership.findMany({
      where: { propertyId: st.propertyId, role: 'OWNER', revokedAt: null, user: { status: 'ACTIVE' } },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            notificationSettings: { where: { category: 'STATEMENT_RELEASED' }, select: { email: true } },
          },
        },
      },
    });
    const sent = new Set<string>();
    for (const { user } of owners) {
      if (sent.has(user.email) || !(user.notificationSettings[0]?.email ?? defaults.email)) continue;
      sent.add(user.email);
      const message = statementReleasedEmail(user, {
        property: st.property.name,
        month: monthName(month),
        net: formatCad(st.netCents!),
        releasedOn: formatDate(releasedOn),
        url: `${this.env.WEB_URL}/owner/statements/${st.id}`,
      });
      try {
        await this.email.send(message);
      } catch (e) {
        this.logger.error(`Statement email to an owner of ${st.propertyId} failed: ${(e as Error).message}`);
      }
    }
  }
}

function notDraft(month: string) {
  return conflict(
    'STATEMENT_NOT_DRAFT',
    `${monthName(month)} is finalized, so its adjustments are fixed. Add the correction to the next month’s statement.`,
  );
}
