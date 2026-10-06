import { z } from 'zod';
import { ExpenseBearer, ExpenseCategory } from '../enums.js';
import { nonNegativeCents } from '../money.js';
import { id, isoDate, isoDateTime, text } from '../primitives.js';

export const receiptSummary = z.object({
  id,
  fileId: id,
  receiptDate: isoDate,
  description: z.string().nullable(),
  filename: z.string().nullable(),
  contentType: z.string(),
});

export const expense = z.object({
  id,
  propertyId: id,
  category: ExpenseCategory,
  bearer: ExpenseBearer,
  incurredOn: isoDate,
  vendor: z.string().nullable(),
  description: z.string(),
  amountCents: nonNegativeCents,
  gstCents: nonNegativeCents.nullable(),
  pstCents: nonNegativeCents.nullable(),
  receipts: z.array(receiptSummary),
  /** Owner-borne and no active receipt yet: blocks finalizing its month (Phase 2b). */
  missingReceipt: z.boolean(),
  voidedAt: isoDateTime.nullable(),
  // Admin-only:
  voidReason: z.string().nullable().optional(),
  version: z.number().int().optional(),
  createdAt: isoDateTime.optional(),
});
export type Expense = z.infer<typeof expense>;

const expenseFields = {
  category: ExpenseCategory,
  bearer: ExpenseBearer,
  incurredOn: isoDate,
  vendor: text(200).nullable(),
  description: text(500),
  amountCents: nonNegativeCents,
  gstCents: nonNegativeCents.nullable(),
  pstCents: nonNegativeCents.nullable(),
};

export const createExpense = z.object({
  ...expenseFields,
  bearer: expenseFields.bearer.default('OWNER'),
  vendor: expenseFields.vendor.default(null),
  gstCents: expenseFields.gstCents.default(null),
  pstCents: expenseFields.pstCents.default(null),
});
export type CreateExpense = z.input<typeof createExpense>;

export const updateExpense = z
  .object(expenseFields)
  .partial()
  .extend({ version: z.number().int().min(0) });
export type UpdateExpense = z.infer<typeof updateExpense>;

export const voidRecord = z.object({ reason: text(500) });
export type VoidRecord = z.infer<typeof voidRecord>;

export const expenseRangeQuery = z.object({
  /** incurredOn in [from, to). */
  from: isoDate,
  to: isoDate,
  includeVoided: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default(false),
});
export type ExpenseRangeQuery = z.infer<typeof expenseRangeQuery>;

export const allExpensesQuery = expenseRangeQuery.extend({ propertyId: id.optional() });
export type AllExpensesQuery = z.infer<typeof allExpensesQuery>;

export const expenseList = z.object({ items: z.array(expense) });

// ── Receipts ──

export const receipt = receiptSummary.extend({
  propertyId: id,
  expenseId: id.nullable(),
  voidedAt: isoDateTime.nullable(),
  voidReason: z.string().nullable().optional(),
  createdAt: isoDateTime,
});
export type Receipt = z.infer<typeof receipt>;

export const createReceipt = z.object({
  fileId: id,
  expenseId: id.nullable().default(null),
  receiptDate: isoDate,
  description: z.string().trim().max(500).nullable().default(null),
});
export type CreateReceipt = z.input<typeof createReceipt>;

export const receiptList = z.object({ items: z.array(receipt) });
