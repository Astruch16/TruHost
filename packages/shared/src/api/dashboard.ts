import { z } from 'zod';
import { BookingKind } from '../enums.js';
import { cents, nonNegativeCents } from '../money.js';
import { bps, id, isoDate, month } from '../primitives.js';
import { propertyPhotoLinks } from './properties.js';

export const dashboardQuery = z.object({ month, propertyId: id.optional() });
export type DashboardQuery = z.infer<typeof dashboardQuery>;

/**
 * COMPLETE: the month has ended. MONTH_TO_DATE: it is the current month (cards say "month to date").
 * UPCOMING: a future month (figures are what's booked so far).
 */
export const DashboardPeriod = z.enum(['COMPLETE', 'MONTH_TO_DATE', 'UPCOMING']);
export type DashboardPeriod = z.infer<typeof DashboardPeriod>;

/** Why there is no "vs. previous month". */
export const NoComparisonReason = z.enum([
  'MONTH_NOT_ENDED',
  'NO_PLAN_IN_PREVIOUS_MONTH',
  'PREVIOUS_MONTH_INCOMPLETE',
  'NO_PROPERTIES',
]);

/** Change against the previous month. Relative (bps of the previous value) except occupancy, in points (bps). */
const change = z.object({ previous: cents.nullable(), changeBps: z.number().int().nullable() });

export const dashboard = z.object({
  month,
  /** Local date the period was judged against. */
  today: isoDate,
  period: DashboardPeriod,
  scope: z.object({ propertyId: id.nullable(), propertyCount: z.number().int() }),
  kpis: z.object({
    grossCents: nonNegativeCents,
    stays: z.number().int(),
    incompleteBookings: z.number().int(),
    managementFeeCents: nonNegativeCents,
    /** Distinct plan rates in force across the scope (one entry when all properties share a rate). */
    feeRatesBps: z.array(bps),
    nightsBooked: z.number().int(),
    availableNights: z.number().int(),
    occupancyBps: bps.nullable(),
    avgNightlyEarningsCents: nonNegativeCents.nullable(),
    completeNights: z.number().int(),
    /** The gross of each stay that makes up grossCents, in check-in order (they sum to grossCents). */
    grossByStayCents: z.array(nonNegativeCents),
    /** The fee as a share of gross, in bps, half up. Null when there is no gross. */
    feeShareBps: bps.nullable(),
    /**
     * One entry per day of the month: how many properties had that night booked, and at how many it could be
     * sold (not an owner stay or block). One property: 1/1 booked, 0/1 open, 0/0 unavailable.
     */
    nightsByDay: z.array(z.object({ booked: z.number().int(), available: z.number().int() })),
    /** Lowest and highest nightly earnings among complete stays (each stay's gross ÷ its nights, half up). */
    nightlyLowCents: nonNegativeCents.nullable(),
    nightlyHighCents: nonNegativeCents.nullable(),
  }),
  /** Present only when both this month and the previous one are complete, fully planned and fully entered. */
  comparison: z
    .object({
      month,
      grossCents: change,
      managementFeeCents: change,
      nightsBooked: change,
      occupancyBps: change,
      avgNightlyEarningsCents: change,
    })
    .nullable(),
  noComparisonReason: NoComparisonReason.nullable(),
  breakdown: z.object({
    grossCents: nonNegativeCents,
    managementFeeCents: nonNegativeCents,
    ownerExpensesCents: nonNegativeCents,
    netToOwnersCents: cents,
    /** TruHost revenue, shown separately. */
    cleaningFeesCents: nonNegativeCents,
  }),
  properties: z.array(
    z.object({
      id,
      name: z.string(),
      city: z.string(),
      province: z.string(),
      archived: z.boolean(),
      hasPlan: z.boolean(),
      coverPhoto: propertyPhotoLinks.nullable(),
      occupancyBps: bps.nullable(),
      nightsBooked: z.number().int(),
      grossCents: nonNegativeCents,
    }),
  ),
  attention: z.object({
    total: z.number().int(),
    items: z.array(
      z.object({
        kind: z.enum(['PAYOUT_MISSING', 'RECEIPT_MISSING', 'NO_PLAN', 'INVITE_PENDING']),
        /** The booking, expense, property or invite this is about. */
        id,
        propertyId: id.nullable(),
        propertyName: z.string().nullable(),
        title: z.string(),
        detail: z.string(),
        /** Relevant date (check-in, purchase date, invite date), for sorting and linking. */
        date: isoDate.nullable(),
      }),
    ),
  }),
  upcoming: z.object({
    total: z.number().int(),
    items: z.array(
      z.object({
        type: z.enum(['CHECK_IN', 'CHECK_OUT']),
        date: isoDate,
        bookingId: id,
        propertyId: id,
        propertyName: z.string(),
        kind: BookingKind,
        nights: z.number().int(),
        guestName: z.string().nullable(),
      }),
    ),
  }),
});
export type Dashboard = z.infer<typeof dashboard>;
