import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { AllExpensesQuery, ExpenseRangeQuery, UpdateExpense } from '@truhost/shared';
import type { createExpense, createReceipt } from '@truhost/shared';
import type { z } from 'zod';
import { AccessService } from '../access/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { Actor } from '../auth/actor.js';
import { fromIsoDate, toIsoDate } from '../common/dates.js';
import { conflict, notFound, ProblemException, unprocessable } from '../common/problem.js';
import { ENV, type Env } from '../config/env.js';
import { FilesService } from '../files/files.service.js';
import { Prisma, type Expense } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const RECEIPT_INCLUDE = { file: { select: { originalFilename: true, contentType: true } } } as const;
const EXPENSE_INCLUDE = {
  receipts: { where: { voidedAt: null }, include: RECEIPT_INCLUDE, orderBy: { createdAt: 'asc' } },
} as const;
type ExpenseRow = Prisma.ExpenseGetPayload<{ include: typeof EXPENSE_INCLUDE }>;
type ReceiptRow = Prisma.ReceiptGetPayload<{ include: typeof RECEIPT_INCLUDE }>;

const WRITABLE = [
  'category',
  'bearer',
  'incurredOn',
  'vendor',
  'description',
  'amountCents',
  'gstCents',
  'pstCents',
] as const;

/** Expenses and their receipts. Owners see only owner-borne, non-voided expenses and their receipts. */
@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly files: FilesService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async listAll(actor: Actor, q: AllExpensesQuery) {
    this.access.assert(actor, 'expense:readAdminFields');
    const rows = await this.prisma.expense.findMany({
      where: { ...this.rangeWhere(q, true), ...(q.propertyId ? { propertyId: q.propertyId } : {}) },
      include: EXPENSE_INCLUDE,
      orderBy: [{ incurredOn: 'asc' }, { id: 'asc' }],
    });
    return { items: rows.map((e) => this.present(actor, e)) };
  }

  async listForProperty(actor: Actor, propertyId: string, q: ExpenseRangeQuery) {
    this.access.assert(actor, 'expense:read', propertyId, 'Property');
    await this.assertPropertyExists(propertyId);
    const admin = this.access.can(actor, 'expense:readAdminFields', propertyId);
    const rows = await this.prisma.expense.findMany({
      where: {
        propertyId,
        ...this.rangeWhere(q, admin),
        ...(admin ? {} : { bearer: 'OWNER' as const }),
      },
      include: EXPENSE_INCLUDE,
      orderBy: [{ incurredOn: 'asc' }, { id: 'asc' }],
    });
    return { items: rows.map((e) => this.present(actor, e)) };
  }

  async create(actor: Actor, propertyId: string, input: z.output<typeof createExpense>) {
    this.access.assert(actor, 'expense:write', propertyId, 'Property');
    this.assertTaxFields(input);
    await this.assertPropertyExists(propertyId);
    return this.prisma.$transaction(async (tx) => {
      // TODO(phase 2b): 409 PERIOD_LOCKED when incurredOn falls in a finalized month.
      const row = await tx.expense.create({
        data: { ...input, incurredOn: fromIsoDate(input.incurredOn), propertyId, enteredById: actor.userId },
        include: EXPENSE_INCLUDE,
      });
      await this.audit.record(tx, actor, {
        action: 'expense.create',
        entityType: 'Expense',
        entityId: row.id,
        propertyId,
        after: { ...input },
      });
      return this.present(actor, row);
    });
  }

  async update(actor: Actor, id: string, input: UpdateExpense) {
    const existing = await this.findWritable(actor, id);
    if (existing.voidedAt) throw conflict('EXPENSE_VOIDED', 'Voided expenses cannot be edited');
    this.assertTaxFields(input);
    return this.prisma.$transaction(async (tx) => {
      const changes: Record<string, unknown> = {};
      for (const key of WRITABLE) if (input[key] !== undefined) changes[key] = input[key];
      if (typeof changes.incurredOn === 'string') changes.incurredOn = fromIsoDate(changes.incurredOn);
      const { count } = await tx.expense.updateMany({
        where: { id, version: input.version, voidedAt: null },
        data: { ...changes, version: { increment: 1 } },
      });
      if (count !== 1) throw staleVersion();
      const after = await tx.expense.findUniqueOrThrow({ where: { id }, include: EXPENSE_INCLUDE });
      await this.audit.recordUpdate(
        tx,
        actor,
        { action: 'expense.update', entityType: 'Expense', entityId: id, propertyId: after.propertyId },
        auditView(existing),
        auditView(after),
      );
      return this.present(actor, after);
    });
  }

  async void(actor: Actor, id: string, reason: string) {
    const existing = await this.findWritable(actor, id);
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.expense.updateMany({
        where: { id, voidedAt: null },
        data: { voidedAt: new Date(), voidedById: actor.userId, voidReason: reason, version: { increment: 1 } },
      });
      if (count !== 1) throw conflict('EXPENSE_VOIDED', 'This expense is already voided');
      const after = await tx.expense.findUniqueOrThrow({ where: { id }, include: EXPENSE_INCLUDE });
      await this.audit.record(tx, actor, {
        action: 'expense.void',
        entityType: 'Expense',
        entityId: id,
        propertyId: existing.propertyId,
        before: { amountCents: existing.amountCents },
        after: { voidReason: reason },
      });
      return this.present(actor, after);
    });
  }

  // ── Receipts ──

  async listReceipts(actor: Actor, propertyId: string, q: ExpenseRangeQuery) {
    this.access.assert(actor, 'receipt:read', propertyId, 'Property');
    await this.assertPropertyExists(propertyId);
    const admin = this.access.can(actor, 'expense:readAdminFields', propertyId);
    const rows = await this.prisma.receipt.findMany({
      where: {
        propertyId,
        receiptDate: { gte: fromIsoDate(q.from), lt: fromIsoDate(q.to) },
        ...(admin && q.includeVoided ? {} : { voidedAt: null }),
        ...(admin ? {} : { expense: { bearer: 'OWNER', voidedAt: null } }),
      },
      include: RECEIPT_INCLUDE,
      orderBy: [{ receiptDate: 'asc' }, { id: 'asc' }],
    });
    return { items: rows.map((r) => this.presentReceipt(actor, r)) };
  }

  /** Attaches a finished upload as a receipt, verifying the stored bytes in the same transaction. */
  async createReceipt(actor: Actor, propertyId: string, input: z.output<typeof createReceipt>) {
    this.access.assert(actor, 'receipt:write', propertyId, 'Property');
    await this.assertPropertyExists(propertyId);
    return this.prisma.$transaction(async (tx) => {
      if (input.expenseId) {
        const expense = await tx.expense.findUnique({ where: { id: input.expenseId } });
        if (!expense || expense.propertyId !== propertyId) {
          throw unprocessable('UNKNOWN_EXPENSE', 'Expense not found on this property');
        }
        if (expense.voidedAt) throw unprocessable('EXPENSE_VOIDED', 'Cannot attach a receipt to a voided expense');
      }
      await this.files.verifyForAttach(tx, actor, input.fileId, { propertyId, purpose: 'RECEIPT' });
      const row = await tx.receipt.create({
        data: {
          propertyId,
          expenseId: input.expenseId,
          fileId: input.fileId,
          receiptDate: fromIsoDate(input.receiptDate),
          description: input.description,
          uploadedById: actor.userId,
        },
        include: RECEIPT_INCLUDE,
      });
      await this.audit.record(tx, actor, {
        action: 'receipt.create',
        entityType: 'Receipt',
        entityId: row.id,
        propertyId,
        after: { expenseId: input.expenseId, fileId: input.fileId, receiptDate: input.receiptDate },
      });
      return this.presentReceipt(actor, row);
    });
  }

  async voidReceipt(actor: Actor, id: string, reason: string) {
    const existing = await this.prisma.receipt.findUnique({ where: { id } });
    if (!existing || !this.access.can(actor, 'receipt:write', existing.propertyId)) throw notFound('Receipt');
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.receipt.updateMany({
        where: { id, voidedAt: null },
        data: { voidedAt: new Date(), voidedById: actor.userId, voidReason: reason },
      });
      if (count !== 1) throw conflict('RECEIPT_VOIDED', 'This receipt is already voided');
      await this.audit.record(tx, actor, {
        action: 'receipt.void',
        entityType: 'Receipt',
        entityId: id,
        propertyId: existing.propertyId,
        after: { voidReason: reason },
      });
      return this.presentReceipt(
        actor,
        await tx.receipt.findUniqueOrThrow({ where: { id }, include: RECEIPT_INCLUDE }),
      );
    });
  }

  // ── helpers ──

  private rangeWhere(q: ExpenseRangeQuery, admin: boolean) {
    return {
      incurredOn: { gte: fromIsoDate(q.from), lt: fromIsoDate(q.to) },
      ...(admin && q.includeVoided ? {} : { voidedAt: null }),
    };
  }

  private async findWritable(actor: Actor, id: string): Promise<Expense> {
    const row = await this.prisma.expense.findUnique({ where: { id } });
    if (!row || !this.access.can(actor, 'expense:write', row.propertyId)) throw notFound('Expense');
    return row;
  }

  private assertTaxFields(input: { gstCents?: number | null; pstCents?: number | null }) {
    if (!this.env.TAX_FIELDS_ENABLED && (input.gstCents != null || input.pstCents != null)) {
      throw new ProblemException({
        status: HttpStatus.BAD_REQUEST,
        code: 'VALIDATION_FAILED',
        detail: 'Request validation failed',
        extras: {
          errors: (['gstCents', 'pstCents'] as const)
            .filter((k) => input[k] != null)
            .map((path) => ({ path, message: 'Tax fields are disabled' })),
        },
      });
    }
  }

  private async assertPropertyExists(id: string) {
    if (!(await this.prisma.property.count({ where: { id } }))) throw notFound('Property');
  }

  private present(actor: Actor, e: ExpenseRow) {
    const base = {
      id: e.id,
      propertyId: e.propertyId,
      category: e.category,
      bearer: e.bearer,
      incurredOn: toIsoDate(e.incurredOn),
      vendor: e.vendor,
      description: e.description,
      amountCents: e.amountCents,
      gstCents: e.gstCents,
      pstCents: e.pstCents,
      receipts: e.receipts.map((r) => receiptSummary(r)),
      missingReceipt: e.bearer === 'OWNER' && !e.voidedAt && e.receipts.length === 0,
      voidedAt: e.voidedAt,
    };
    if (!this.access.can(actor, 'expense:readAdminFields', e.propertyId)) return base;
    return { ...base, voidReason: e.voidReason, version: e.version, createdAt: e.createdAt };
  }

  private presentReceipt(actor: Actor, r: ReceiptRow) {
    return {
      ...receiptSummary(r),
      propertyId: r.propertyId,
      expenseId: r.expenseId,
      voidedAt: r.voidedAt,
      createdAt: r.createdAt,
      ...(this.access.can(actor, 'expense:readAdminFields', r.propertyId) ? { voidReason: r.voidReason } : {}),
    };
  }
}

function receiptSummary(r: ReceiptRow) {
  return {
    id: r.id,
    fileId: r.fileId,
    receiptDate: toIsoDate(r.receiptDate),
    description: r.description,
    filename: r.file.originalFilename,
    contentType: r.file.contentType,
  };
}

function auditView(e: Expense) {
  return {
    category: e.category,
    bearer: e.bearer,
    incurredOn: toIsoDate(e.incurredOn),
    vendor: e.vendor,
    description: e.description,
    amountCents: e.amountCents,
    gstCents: e.gstCents,
    pstCents: e.pstCents,
  };
}

function staleVersion() {
  return conflict('STALE_VERSION', 'This expense was changed by someone else. Reload and try again.');
}
