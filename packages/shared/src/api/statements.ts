import { z } from 'zod';
import { BookingChannel, ExpenseCategory, StatementLineKind, StatementStatus } from '../enums.js';
import { cents, nonNegativeCents } from '../money.js';
import { bps, id, isoDate, isoDateTime, month, text } from '../primitives.js';
import { receiptSummary } from './expenses.js';

/**
 * Owner statements (docs/spec.md §4, Phase 2b): one per property per month, DRAFT → FINALIZED → RELEASED. Every
 * figure here is computed by the API (apps/api/src/reporting/statement.ts); the web app only displays it.
 */

/** Where a property's statement for a month stands; NOT_STARTED means no draft exists yet. */
export const StatementState = z.enum(['NOT_STARTED', 'DRAFT', 'FINALIZED', 'RELEASED']);
export type StatementState = z.infer<typeof StatementState>;

const person = z.object({ id, firstName: z.string(), lastName: z.string() });

export const statementTotals = z.object({
  nightsBooked: z.number().int(),
  /** Owner gross: payout − guest cleaning fee, split per night into the month. */
  grossCents: nonNegativeCents,
  /** The plan rate in force for the month (TruPlan is 2200). Null when no plan applies (blocks finalizing). */
  managementFeeBps: bps.nullable(),
  managementFeeCents: nonNegativeCents,
  /** Owner-borne expenses purchased in the month. */
  expensesCents: nonNegativeCents,
  /** The property's standard cleaning fee for each owner stay checking out in the month. */
  ownerStayCleaningCents: nonNegativeCents,
  adjustmentsCents: cents,
  /** gross − fee − expenses − owner-stay cleaning + adjustments. */
  netCents: cents,
});
export type StatementTotals = z.infer<typeof statementTotals>;

export const statementLine = z.object({
  kind: StatementLineKind,
  bookingId: id.nullable(),
  expenseId: id.nullable(),
  adjustmentId: id.nullable(),
  /** Stays and owner-stay cleaning: check-in. Expense: purchase date. Adjustment: the day it was added. */
  date: isoDate,
  /** Stays and owner-stay cleaning: check-out. */
  endDate: isoDate.nullable(),
  channel: BookingChannel.nullable(),
  category: ExpenseCategory.nullable(),
  description: z.string(),
  detail: z.string().nullable(),
  /** Stays: nights in this month and in the whole stay (they differ when a stay crosses a month end). */
  nights: z.number().int().nullable(),
  totalNights: z.number().int().nullable(),
  /** Stays: owner gross of the whole stay; `amountCents` is this month's share of it. */
  stayGrossCents: nonNegativeCents.nullable(),
  /** Cancelled, but paid out: all of it lands in the check-in month. */
  cancelled: z.boolean(),
  /** Payout not entered (yet, or when finalized): counted at $0. */
  payoutPending: z.boolean(),
  /** Signed, from the owner's point of view. */
  amountCents: cents,
  /** Admin: the guest on a stay line (never shown to owners). */
  guestName: z.string().nullable().optional(),
  /** Expense lines: the expense's current receipts. */
  receipts: z.array(receiptSummary).optional(),
});
export type StatementLine = z.infer<typeof statementLine>;

export const statementAdjustment = z.object({
  id,
  amountCents: cents,
  reason: z.string(),
  /** The earlier statement it corrects. */
  corrects: z.object({ id, month }).nullable(),
  createdAt: isoDateTime,
  createdBy: person,
  voidedAt: isoDateTime.nullable(),
  voidReason: z.string().nullable(),
});
export type StatementAdjustment = z.infer<typeof statementAdjustment>;

export const StatementBlockerCode = z.enum(['MONTH_NOT_OVER', 'EARLIER_DRAFT', 'NO_PLAN', 'MISSING_RECEIPTS']);
export type StatementBlockerCode = z.infer<typeof StatementBlockerCode>;

/** Something that must be fixed before a draft can be finalized. */
export const statementBlocker = z.object({
  code: StatementBlockerCode,
  message: z.string(),
  /** EARLIER_DRAFT: the draft to finalize first. */
  statementId: id.optional(),
  /** MISSING_RECEIPTS: the expenses that need one. */
  expenseIds: z.array(id).optional(),
});
export type StatementBlocker = z.infer<typeof statementBlocker>;

/** A stay counted at $0 because its payout isn't entered: finalizing asks for confirmation first. */
export const pendingPayout = z.object({
  bookingId: id,
  checkInDate: isoDate,
  checkOutDate: isoDate,
  channel: BookingChannel,
  guestName: z.string().nullable(),
});
export type PendingPayout = z.infer<typeof pendingPayout>;

export const statement = z.object({
  id,
  property: z.object({ id, name: z.string(), archived: z.boolean() }),
  /** The property's active owners (named on the PDF). */
  owners: z.array(person),
  month,
  status: StatementStatus,
  /** The plan the fee came from (copied at finalize). */
  plan: z.object({ name: z.string(), managementFeeBps: bps }).nullable(),
  /** Live while DRAFT; the stored copy once finalized. */
  totals: statementTotals,
  lines: z.array(statementLine),
  /** Every adjustment added to this statement, voided ones included. */
  adjustments: z.array(statementAdjustment),
  /** DRAFT only: what stops it being finalized. */
  blockers: z.array(statementBlocker),
  /** DRAFT only: stays still waiting on their payout. */
  pendingPayouts: z.array(pendingPayout),
  /** Earlier finalized statements of this property that an adjustment can say it corrects. */
  correctable: z.array(z.object({ id, month, status: StatementStatus })),
  created: z.object({ at: isoDateTime, by: person }),
  finalized: z.object({ at: isoDateTime, by: person }).nullable(),
  released: z.object({ on: isoDate, at: isoDateTime, by: person, paymentReference: z.string().nullable() }).nullable(),
  /** The PDF stored at release: open it through GET /files/:id/url. */
  pdf: z.object({ fileId: id, sha256: z.string(), sizeBytes: z.number().int() }).nullable(),
  calcVersion: z.number().int().nullable(),
  /** What the caller may do now (decided by the API). */
  can: z.object({ finalize: z.boolean(), release: z.boolean(), adjust: z.boolean(), preview: z.boolean() }),
});
export type Statement = z.infer<typeof statement>;

/** One property's statement for a month, as listed on the Statements page. */
export const statementRow = z.object({
  property: z.object({ id, name: z.string(), archived: z.boolean() }),
  /** Null while NOT_STARTED. */
  statementId: id.nullable(),
  state: StatementState,
  nightsBooked: z.number().int(),
  grossCents: nonNegativeCents,
  /** Live for NOT_STARTED and DRAFT; the stored copy once finalized. */
  netCents: cents,
  /** Live for NOT_STARTED and DRAFT; 0 once finalized. */
  blockers: z.number().int(),
  pendingPayouts: z.number().int(),
  finalizedAt: isoDateTime.nullable(),
  releasedOn: isoDate.nullable(),
});
export type StatementRow = z.infer<typeof statementRow>;

export const statementMonth = z.object({
  month,
  items: z.array(statementRow),
  totals: z.object({
    /** Sum of every row's net. */
    netCents: cents,
    /** Finalized and waiting to be paid out. */
    toReleaseCents: cents,
    releasedCents: cents,
    counts: z.object({
      NOT_STARTED: z.number().int(),
      DRAFT: z.number().int(),
      FINALIZED: z.number().int(),
      RELEASED: z.number().int(),
    }),
  }),
});
export type StatementMonth = z.infer<typeof statementMonth>;

export const statementSummary = z.object({
  id,
  month,
  status: StatementStatus,
  netCents: cents,
  finalizedAt: isoDateTime.nullable(),
  releasedOn: isoDate.nullable(),
});
export const statementList = z.object({ items: z.array(statementSummary) });

export const statementMonthQuery = z.object({ month });

export const createStatement = z.object({ month });
export type CreateStatement = z.infer<typeof createStatement>;

export const generateStatements = z.object({ month });
export type GenerateStatements = z.infer<typeof generateStatements>;

export const generatedStatements = statementMonth.extend({
  /** Drafts created by this request (properties that already had one, or can't have one, are left alone). */
  created: z.number().int(),
});

export const finalizeStatement = z.object({
  /** Required when stays are still waiting on their payout: they're finalized at $0. */
  confirmPendingPayouts: z.boolean().default(false),
});
export type FinalizeStatement = z.input<typeof finalizeStatement>;

export const releaseStatement = z.object({
  /** The day the money was sent to the owner. */
  releasedOn: isoDate,
  /** e-Transfer or bank reference. */
  paymentReference: text(100).nullable().default(null),
});
export type ReleaseStatement = z.input<typeof releaseStatement>;

/** Largest adjustment in either direction: $100,000. A typo guard, not a business rule. */
export const MAX_ADJUSTMENT_CENTS = 10_000_000;

export const createAdjustment = z.object({
  /** Signed, from the owner's point of view: positive pays the owner more. */
  amountCents: cents
    .min(-MAX_ADJUSTMENT_CENTS)
    .max(MAX_ADJUSTMENT_CENTS)
    .refine((n) => n !== 0, { message: 'Enter an amount other than zero' }),
  reason: text(500),
  correctsStatementId: id.nullable().default(null),
});
export type CreateAdjustment = z.input<typeof createAdjustment>;
