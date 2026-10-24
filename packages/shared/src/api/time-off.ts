import { z } from 'zod';
import { TimeOffReason, TimeOffStatus } from '../enums.js';
import { id, isoDate, isoDateTime } from '../primitives.js';

/** The longest one request can be, in days (inclusive). */
export const MAX_TIME_OFF_DAYS = 90;

export const TIME_OFF_REASON_LABELS: Record<TimeOffReason, string> = {
  HOLIDAY: 'Holiday',
  TIME_OFF: 'Time off',
  OTHER_WORK: 'Other work',
  OTHER: 'Something else',
};

export const TIME_OFF_STATUS_LABELS: Record<TimeOffStatus, string> = {
  PENDING: 'Waiting for TruHost',
  APPROVED: 'Approved',
  DECLINED: 'Declined',
  CANCELLED: 'Cancelled',
};

/** Optional text: trimmed, at most 500 characters; blank is none. */
const note = z
  .string()
  .trim()
  .max(500, 'Keep it under 500 characters')
  .transform((v) => v || null)
  .nullable();

/** `POST /time-off`: a cleaner asks for days off (inclusive dates, today or later, at most 90 days). */
export const createTimeOff = z
  .object({ startDate: isoDate, endDate: isoDate, reason: TimeOffReason, note: note.default(null) })
  .refine((v) => v.endDate >= v.startDate, { path: ['endDate'], message: 'The last day can’t be before the first' });
export type CreateTimeOff = z.input<typeof createTimeOff>;

/** `POST /time-off/:id/decision`: an admin approves or declines a pending request, with an optional note. */
export const decideTimeOff = z.object({ status: z.enum(['APPROVED', 'DECLINED']), note });
export type DecideTimeOff = z.input<typeof decideTimeOff>;

/** `GET /time-off`: by status, and those ending on or after `from`. A cleaner sees only their own. */
export const timeOffQuery = z.object({ status: TimeOffStatus.optional(), from: isoDate.optional() });
export type TimeOffQuery = z.infer<typeof timeOffQuery>;

const person = z.object({ id, firstName: z.string(), lastName: z.string() });

export const timeOffRequest = z.object({
  id,
  cleaner: person,
  startDate: isoDate,
  endDate: isoDate,
  /** Days asked for, inclusive. */
  days: z.number().int(),
  reason: TimeOffReason,
  note: z.string().nullable(),
  status: TimeOffStatus,
  decidedBy: person.nullable(),
  decidedAt: isoDateTime.nullable(),
  decisionNote: z.string().nullable(),
  cancelledAt: isoDateTime.nullable(),
  createdAt: isoDateTime,
  /** The cleaner's cleans still to do in these dates (to reassign if it's approved). */
  conflicts: z.array(z.object({ cleanId: id, date: isoDate, property: z.object({ id, name: z.string() }) })),
  can: z.object({
    /** Its cleaner: while pending, or approved and not over. */
    cancel: z.boolean(),
    /** Admins: while pending. */
    decide: z.boolean(),
  }),
});
export type TimeOffRequest = z.infer<typeof timeOffRequest>;

export const timeOffList = z.object({ items: z.array(timeOffRequest) });
export type TimeOffList = z.infer<typeof timeOffList>;
