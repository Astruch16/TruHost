import { z } from 'zod';
import { BookingKind, CleanKind, CleanStatus, DamageStatus, PhotoPhase } from '../enums.js';
import { nonNegativeCents } from '../money.js';
import { id, isoDate, isoDateTime, timeOfDay } from '../primitives.js';
import { recordSupplyLevels } from './supplies.js';

export const CLEAN_STATUS_LABELS: Record<CleanStatus, string> = {
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In progress',
  COMPLETE: 'Complete',
  CANCELLED: 'Cancelled',
};

/** The most photos one room can hold in one phase of a clean (extra shots replace nothing; they add). */
export const MAX_CLEAN_PHOTOS_PER_ROOM_PHASE = 12;

/** `GET /cleans`: by property, date range (scheduled day), status, and the caller's own. */
export const cleanQuery = z.object({
  propertyId: id.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  status: CleanStatus.optional(),
  assignee: z.literal('me').optional(),
});
export type CleanQuery = z.infer<typeof cleanQuery>;

const person = z.object({ id, firstName: z.string(), lastName: z.string() });

/** A moment in the property's own time: its calendar date and, when known, the time of day. */
const localMoment = z.object({ date: isoDate, time: timeOfDay.nullable() });

/** A clean as lists show it. */
export const cleanSummary = z.object({
  id,
  property: z.object({ id, name: z.string(), city: z.string() }),
  kind: CleanKind,
  status: CleanStatus,
  scheduledDate: isoDate,
  /** The stay a turnover follows (null for an ad-hoc clean). */
  stay: z.object({ kind: BookingKind, checkInDate: isoDate, checkOutDate: isoDate }).nullable(),
  /**
   * When the place is free: from the stay's check-out, until the next arrival's check-in (null when nothing is booked
   * after it). Worked out from the bookings, in the property's time.
   */
  window: z.object({ from: localMoment, until: localMoment.nullable() }),
  assignedCleaner: person.nullable(),
  /** What the clean pays its cleaner: shown to admins, and to the cleaner on their own cleans; otherwise null. */
  cleanerPayCents: nonNegativeCents.nullable(),
  notes: z.string().nullable(),
  startedAt: isoDateTime.nullable(),
  completedAt: isoDateTime.nullable(),
  cancelledAt: isoDateTime.nullable(),
  cancelReason: z.string().nullable(),
  /** Rooms with both a BEFORE and an AFTER photo, out of the property's active rooms. */
  progress: z.object({ rooms: z.number().int(), done: z.number().int() }),
});
export type CleanSummary = z.infer<typeof cleanSummary>;

export const cleanList = z.object({ items: z.array(cleanSummary) });
export type CleanList = z.infer<typeof cleanList>;

export const cleanPhoto = z.object({
  id,
  roomId: id,
  phase: PhotoPhase,
  /** Signed, short-lived links: the evidence copy and a thumbnail. */
  url: z.string(),
  thumbUrl: z.string(),
  expiresAt: isoDateTime,
  uploadedBy: person,
  createdAt: isoDateTime,
});
export type CleanPhoto = z.infer<typeof cleanPhoto>;

/** One room of the checklist, in walkthrough order, with its photos (oldest first). */
export const cleanRoom = z.object({
  id,
  displayName: z.string(),
  before: z.array(cleanPhoto),
  after: z.array(cleanPhoto),
});
export type CleanRoom = z.infer<typeof cleanRoom>;

/**
 * A clean's checklist, in the order it's worked: a before photo of every room, the damage question (yes needs a damage
 * report sent from the clean), a count of every supply, an after photo of every room, then finishing. Each step opens
 * once the ones before it are done (the API and the database enforce the order).
 */
export const CleanStep = z.enum(['BEFORE_PHOTOS', 'DAMAGE', 'STOCK_COUNT', 'AFTER_PHOTOS', 'FINISH']);
export type CleanStep = z.infer<typeof CleanStep>;

export const CLEAN_STEP_LABELS: Record<CleanStep, string> = {
  BEFORE_PHOTOS: 'Before photos',
  DAMAGE: 'Any damage?',
  STOCK_COUNT: 'Stock count',
  AFTER_PHOTOS: 'After photos',
  FINISH: 'Clean finished',
};

export const cleanChecklist = z.object({
  beforePhotos: z.object({ done: z.boolean() }),
  damage: z.object({
    /** The cleaner's answer: null until answered. */
    found: z.boolean().nullable(),
    /** Reports made from this clean (drafts only to their reporter and admins). */
    reports: z.array(z.object({ id, title: z.string(), status: DamageStatus, photoCount: z.number().int() })),
    /** Answered no, or yes with a report sent. */
    done: z.boolean(),
  }),
  stockCount: z.object({
    /** The property's active supplies, and how many have a level from this clean. */
    items: z.number().int(),
    counted: z.number().int(),
    done: z.boolean(),
    /** What this clean's count put at or below its restock point, emptiest first. */
    restock: z.array(z.object({ id, name: z.string(), levelPct: z.number().int(), state: z.enum(['LOW', 'OUT']) })),
  }),
  afterPhotos: z.object({ done: z.boolean() }),
  /** The first step not yet done (FINISH once everything else is); null unless the clean is in progress. */
  current: CleanStep.nullable(),
});
export type CleanChecklist = z.infer<typeof cleanChecklist>;

/** One clean with its room checklist, and what the caller may do now. */
export const clean = cleanSummary.extend({
  rooms: z.array(cleanRoom),
  checklist: cleanChecklist,
  /** Today in the property's time zone (a cleaner starts on the scheduled day). */
  today: isoDate,
  can: z.object({
    start: z.boolean(),
    /** Before photos: while in progress. */
    addPhotos: z.boolean(),
    /** Once the steps before them are done. */
    addAfterPhotos: z.boolean(),
    checkDamage: z.boolean(),
    countStock: z.boolean(),
    /** Every step is done: "Clean finished". */
    complete: z.boolean(),
  }),
});
export type Clean = z.infer<typeof clean>;

export const cleanPhotoList = z.object({ items: z.array(cleanPhoto) });

/** Attach an uploaded CLEAN_PHOTO (both renditions) to a room, before or after. */
export const addCleanPhoto = z.object({ roomId: id, phase: PhotoPhase, fileId: id, thumbFileId: id });
export type AddCleanPhoto = z.infer<typeof addCleanPhoto>;

/** `POST /cleans/:id/damage-check`: the checklist's damage question. */
export const cleanDamageCheck = z.object({ found: z.boolean() });
export type CleanDamageCheck = z.infer<typeof cleanDamageCheck>;

/** `POST /cleans/:id/stock-count`: a level for every active supply at the property (it can be counted again). */
export const cleanStockCount = recordSupplyLevels;
export type CleanStockCount = z.input<typeof cleanStockCount>;

/** The rooms (and phases) still without a photo, in 422 CLEAN_MISSING_PHOTOS. */
export const missingCleanPhotos = z.array(
  z.object({ roomId: id, displayName: z.string(), phases: z.array(PhotoPhase) }),
);
export type MissingCleanPhotos = z.infer<typeof missingCleanPhotos>;
