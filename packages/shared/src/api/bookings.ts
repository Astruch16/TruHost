import { z } from 'zod';
import { BookingChannel, BookingKind, BookingSource, BookingStatus } from '../enums.js';
import { nonNegativeCents } from '../money.js';
import { id, isoDate, isoDateTime, text, timeOfDay } from '../primitives.js';

const MAX_NIGHTS = 365;
const nightsBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/**
 * A booking as returned by the API. Admin-only fields (guest details, raw payout and cleaning fee, notes) are
 * omitted for owners, who see `ownerGrossCents` instead.
 */
export const booking = z.object({
  id,
  propertyId: id,
  source: BookingSource,
  channel: BookingChannel,
  kind: BookingKind,
  status: BookingStatus,
  checkInDate: isoDate,
  checkOutDate: isoDate,
  nights: z.number().int().positive(),
  /** Payout minus cleaning fee; null for non-guest stays or while either amount is missing. Computed by the API. */
  ownerGrossCents: nonNegativeCents.nullable(),
  /** False for a guest stay whose payout or cleaning fee hasn't been entered yet. */
  complete: z.boolean(),
  cancelledAt: isoDateTime.nullable(),
  // Admin-only:
  externalId: z.string().nullable().optional(),
  checkInTimeOverride: z.string().nullable().optional(),
  checkOutTimeOverride: z.string().nullable().optional(),
  guestName: z.string().nullable().optional(),
  guestCount: z.number().int().nullable().optional(),
  payoutCents: nonNegativeCents.nullable().optional(),
  guestCleaningFeeCents: nonNegativeCents.nullable().optional(),
  taxesCollectedCents: nonNegativeCents.nullable().optional(),
  cancellationNote: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  version: z.number().int().optional(),
  createdAt: isoDateTime.optional(),
});
export type Booking = z.infer<typeof booking>;

/** Field rules without defaults (update schemas must never inject defaults). */
const bookingFields = {
  channel: BookingChannel,
  kind: BookingKind,
  checkInDate: isoDate,
  checkOutDate: isoDate,
  externalId: text(100).nullable(),
  checkInTimeOverride: timeOfDay.nullable(),
  checkOutTimeOverride: timeOfDay.nullable(),
  guestName: text(200).nullable(),
  guestCount: z.number().int().min(1).max(50).nullable(),
  payoutCents: nonNegativeCents.nullable(),
  guestCleaningFeeCents: nonNegativeCents.nullable(),
  taxesCollectedCents: nonNegativeCents.nullable(),
  notes: z.string().trim().max(2000).nullable(),
};

type BookingShape = {
  kind?: BookingKind;
  checkInDate?: string;
  checkOutDate?: string;
  payoutCents?: number | null;
  guestCleaningFeeCents?: number | null;
  taxesCollectedCents?: number | null;
};

/**
 * Cross-field rules, shared by create (here) and update (the API re-checks the merged record). Returns issues as
 * [path, message] pairs.
 */
export function bookingIssues(b: BookingShape): [string, string][] {
  const issues: [string, string][] = [];
  if (b.checkInDate && b.checkOutDate) {
    const nights = nightsBetween(b.checkInDate, b.checkOutDate);
    if (nights < 1) issues.push(['checkOutDate', 'Check-out must be after check-in']);
    else if (nights > MAX_NIGHTS) issues.push(['checkOutDate', `A stay can be at most ${MAX_NIGHTS} nights`]);
  }
  if (b.kind && b.kind !== 'GUEST') {
    for (const key of ['payoutCents', 'guestCleaningFeeCents', 'taxesCollectedCents'] as const) {
      if (b[key] != null) issues.push([key, 'Only guest stays have money']);
    }
  }
  if (b.payoutCents != null && b.guestCleaningFeeCents != null && b.guestCleaningFeeCents > b.payoutCents) {
    issues.push(['guestCleaningFeeCents', 'Cleaning fee cannot be more than the payout']);
  }
  return issues;
}

const withBookingRules = <T extends z.ZodType<BookingShape>>(schema: T) =>
  schema.superRefine((b, ctx) => {
    for (const [path, message] of bookingIssues(b)) ctx.addIssue({ code: 'custom', path: [path], message });
  });

export const createBooking = withBookingRules(
  z.object({
    ...bookingFields,
    kind: bookingFields.kind.default('GUEST'),
    externalId: bookingFields.externalId.default(null),
    checkInTimeOverride: bookingFields.checkInTimeOverride.default(null),
    checkOutTimeOverride: bookingFields.checkOutTimeOverride.default(null),
    guestName: bookingFields.guestName.default(null),
    guestCount: bookingFields.guestCount.default(null),
    payoutCents: bookingFields.payoutCents.default(null),
    guestCleaningFeeCents: bookingFields.guestCleaningFeeCents.default(null),
    taxesCollectedCents: bookingFields.taxesCollectedCents.default(null),
    notes: bookingFields.notes.default(null),
  }),
);
export type CreateBooking = z.input<typeof createBooking>;

/** Partial update; `version` must match the stored booking (optimistic concurrency). */
export const updateBooking = z
  .object(bookingFields)
  .partial()
  .extend({ version: z.number().int().min(0) });
export type UpdateBooking = z.infer<typeof updateBooking>;

export const cancelBooking = z.object({
  version: z.number().int().min(0),
  note: z.string().trim().max(500).nullable().default(null),
});
export type CancelBooking = z.input<typeof cancelBooking>;

export const MAX_RANGE_DAYS = 400;

const rangeFields = {
  from: isoDate,
  to: isoDate,
  status: BookingStatus.optional(),
  kind: BookingKind.optional(),
};

function checkRange(q: { from: string; to: string }, ctx: z.RefinementCtx) {
  const days = nightsBetween(q.from, q.to);
  if (days < 1) ctx.addIssue({ code: 'custom', path: ['to'], message: '`to` must be after `from`' });
  if (days > MAX_RANGE_DAYS) {
    ctx.addIssue({ code: 'custom', path: ['to'], message: `Range can be at most ${MAX_RANGE_DAYS} days` });
  }
}

/** Bookings overlapping [from, to). Ranges are bounded instead of paginated so calendars get whole months. */
export const bookingRangeQuery = z.object(rangeFields).superRefine(checkRange);
export type BookingRangeQuery = z.infer<typeof bookingRangeQuery>;

export const allBookingsQuery = z.object({ ...rangeFields, propertyId: id.optional() }).superRefine(checkRange);
export type AllBookingsQuery = z.infer<typeof allBookingsQuery>;

export const bookingList = z.object({ items: z.array(booking) });
