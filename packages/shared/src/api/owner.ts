import { z } from 'zod';
import { BookingChannel, BookingKind, ExpenseCategory } from '../enums.js';
import { cents, nonNegativeCents } from '../money.js';
import { bps, id, isoDate, isoDateTime, month } from '../primitives.js';
import { statementLine, statementTotals } from './statements.js';
import { RestockUrgency, supplyItem } from './supplies.js';

/**
 * The owner portal's own API (/v1/owner/...): scoped to the properties the caller owns, never another owner's, and
 * only what an owner may see. Statements are RELEASED ones only; figures come from released statement copies or
 * from the reporting functions (apps/api/src/reporting), never from the web app.
 */

/** `propertyId` narrows to one owned property; omitted, every property the caller owns. */
export const ownerScopeQuery = z.object({ propertyId: id.optional() });
export type OwnerScopeQuery = z.infer<typeof ownerScopeQuery>;

export const ownerProperty = z.object({
  id,
  name: z.string(),
  city: z.string(),
  province: z.string(),
  photo: z.object({ thumbUrl: z.string(), expiresAt: isoDateTime }).nullable(),
});
export const ownerProperties = z.object({ items: z.array(ownerProperty) });
export type OwnerProperty = z.infer<typeof ownerProperty>;

export const ownerHome = z.object({
  /** Property-local today. */
  today: isoDate,
  month,
  properties: z.number().int(),
  /** The latest month with a released statement (summed over the scope), or null before the first release. */
  latest: z
    .object({
      month,
      /** The released statements making it up (one per property). */
      statementIds: z.array(id),
      netCents: cents,
      grossCents: nonNegativeCents,
      nightsBooked: z.number().int(),
      /** The latest payment date among them. */
      releasedOn: isoDate,
      /** Against the released month before it, when there is one. */
      change: z.object({ month, netCents: cents, changeCents: cents }).nullable(),
    })
    .nullable(),
  /** The month in progress, estimated from the stays booked so far (computed live, not a statement). */
  thisMonth: z.object({
    month,
    estimatedNetCents: cents,
    grossCents: nonNegativeCents,
    nightsBooked: z.number().int(),
    /** Booked nights already stayed (before today) and still to come. */
    nightsStayed: z.number().int(),
    nightsUpcoming: z.number().int(),
    daysInMonth: z.number().int(),
    stays: z.number().int(),
    /** Stays whose payout hasn't arrived yet: not in the estimate. */
    pendingPayouts: z.number().int(),
    /** The month whose start brings this month's statement. */
    statementExpected: month,
  }),
  /** This calendar year's released statements. */
  yearToDate: z.object({
    year: z.number().int(),
    /** Released months counted. */
    months: z.number().int(),
    netCents: cents,
    nightsBooked: z.number().int(),
    occupancyBps: bps.nullable(),
    avgNightlyEarningsCents: nonNegativeCents.nullable(),
  }),
  /** January to this month: released nets, this month's estimate, null for months not released yet. */
  netByMonth: z.array(
    z.object({ month, netCents: cents.nullable(), state: z.enum(['RELEASED', 'IN_PROGRESS', 'PENDING']) }),
  ),
  /** The next stays checking in (guest and owner stays; no guest details). */
  comingUp: z.array(
    z.object({
      bookingId: id,
      property: z.object({ id, name: z.string() }),
      kind: z.enum(['GUEST', 'OWNER_STAY']),
      channel: BookingChannel.nullable(),
      checkInDate: isoDate,
      checkOutDate: isoDate,
      nights: z.number().int(),
    }),
  ),
  /** Recent owner-paid expenses and adjustments on released statements, newest first. */
  goodToKnow: z.array(
    z.object({
      id,
      kind: z.enum(['EXPENSE', 'ADJUSTMENT']),
      date: isoDate,
      property: z.object({ id, name: z.string() }),
      title: z.string(),
      /** One line about it, in plain words. */
      detail: z.string(),
      /** Expenses: what kind, and where it was bought. */
      category: ExpenseCategory.nullable(),
      vendor: z.string().nullable(),
      /** Adjustments: the month of the statement it's on. */
      statementMonth: month.nullable(),
      /** Signed, from the owner's point of view. */
      amountCents: cents,
      receiptFileId: id.nullable(),
      statementId: id.nullable(),
    }),
  ),
});
export type OwnerHome = z.infer<typeof ownerHome>;

export const ownerStatementSummary = z.object({
  id,
  property: z.object({ id, name: z.string() }),
  month,
  netCents: cents,
  grossCents: nonNegativeCents,
  releasedOn: isoDate,
});
export const ownerStatementList = z.object({ items: z.array(ownerStatementSummary) });
export type OwnerStatementSummary = z.infer<typeof ownerStatementSummary>;

/** A released statement as its owner sees it: the stored copy, no guest details. */
export const ownerStatement = z.object({
  id,
  property: z.object({ id, name: z.string() }),
  month,
  plan: z.object({ name: z.string(), managementFeeBps: bps }),
  totals: statementTotals,
  lines: z.array(statementLine.omit({ guestName: true })),
  released: z.object({ on: isoDate, paymentReference: z.string().nullable() }),
});
export type OwnerStatement = z.infer<typeof ownerStatement>;

export const ownerCalendarQuery = ownerScopeQuery.extend({ month });

export const ownerCalendar = z.object({
  month,
  items: z.array(
    z.object({
      bookingId: id,
      property: z.object({ id, name: z.string() }),
      kind: BookingKind,
      channel: BookingChannel.nullable(),
      checkInDate: isoDate,
      checkOutDate: isoDate,
      nights: z.number().int(),
      nightsInMonth: z.number().int(),
      /** Guest stays: payout less the cleaning fee for the whole stay, and this month's per-night share of it. */
      ownerGrossCents: nonNegativeCents.nullable(),
      monthShareCents: nonNegativeCents.nullable(),
      /** A guest stay whose payout hasn't arrived yet. */
      payoutPending: z.boolean(),
    }),
  ),
});
export type OwnerCalendar = z.infer<typeof ownerCalendar>;

/**
 * Supplies at each owned property: every active item's level, those that need restocking (now or soon) first, and
 * counts for a one-line summary. Levels are what the cleaners last reported.
 */
export const ownerSupplies = z.object({
  properties: z.array(
    z.object({
      property: z.object({ id, name: z.string() }),
      items: z.array(supplyItem.extend({ urgency: RestockUrgency.nullable() })),
      counts: z.object({
        total: z.number().int(),
        out: z.number().int(),
        low: z.number().int(),
        soon: z.number().int(),
        /** Never checked yet. */
        unchecked: z.number().int(),
      }),
      /** The latest reading at the property, if any. */
      lastCheckedAt: isoDateTime.nullable(),
    }),
  ),
});
export type OwnerSupplies = z.infer<typeof ownerSupplies>;

export const ownerMonthQuery = ownerScopeQuery.extend({ month });

/**
 * One month's earnings at the owned properties: the released statements' figures where they exist, and an estimate
 * from the reporting functions for properties whose statement isn't released yet (`basis` says which).
 */
export const ownerMonth = z.object({
  month,
  /** RELEASED: every property's statement is released. ESTIMATE: none is. MIXED: some are. */
  basis: z.enum(['RELEASED', 'ESTIMATE', 'MIXED']),
  /** The released statements counted (one per property). */
  statementIds: z.array(id),
  /** The latest payment date among them. */
  releasedOn: isoDate.nullable(),
  netCents: cents,
  grossCents: nonNegativeCents,
  managementFeeCents: nonNegativeCents,
  /** Owner-paid expenses, owner-stay cleaning included. */
  expensesCents: nonNegativeCents,
  /** Released statements only (an estimate has none). */
  adjustmentsCents: cents,
  nightsBooked: z.number().int(),
  /** Properties not released yet, counted as an estimate. */
  estimatedProperties: z.number().int(),
  /** Against the month before, on the same terms. */
  change: z.object({ month, netCents: cents, changeCents: cents }),
  /** Where the month stands against today: before it, during it, or after it. */
  timing: z.enum(['PAST', 'CURRENT', 'FUTURE']),
});
export type OwnerMonth = z.infer<typeof ownerMonth>;
