import { z } from 'zod';
import { BookingChannel, DamageSeverity, DamageStatus } from '../enums.js';
import { nonNegativeCents } from '../money.js';
import { id, isoDate, isoDateTime } from '../primitives.js';

export const DAMAGE_SEVERITY_LABELS: Record<DamageSeverity, string> = {
  MINOR: 'Minor',
  MODERATE: 'Moderate',
  SEVERE: 'Severe',
};

export const DAMAGE_STATUS_LABELS: Record<DamageStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Reported',
  ACKNOWLEDGED: 'Acknowledged',
  CLAIM_FILED: 'Claim filed',
  RESOLVED: 'Resolved',
};

/** Airbnb's AirCover: a damage claim must be filed within this many days of checkout. */
export const AIRCOVER_CLAIM_DAYS = 14;
/** The most photos one report can hold. */
export const MAX_DAMAGE_PHOTOS = 30;

const title = z.string().trim().min(1, 'Give it a short title').max(120);
const description = z.string().trim().min(1, 'Describe the damage').max(4000);
const person = z.object({ id, firstName: z.string(), lastName: z.string() });

export const damagePhoto = z.object({
  id,
  /** Signed, short-lived links: the evidence copy and a thumbnail. */
  url: z.string(),
  thumbUrl: z.string(),
  expiresAt: isoDateTime,
  uploadedBy: person,
  createdAt: isoDateTime,
});
export type DamagePhoto = z.infer<typeof damagePhoto>;

/** The stay a report blames, with what a claim needs. */
export const damageStay = z.object({
  id,
  guestName: z.string().nullable(),
  checkInDate: isoDate,
  checkOutDate: isoDate,
  channel: BookingChannel,
});
export type DamageStay = z.infer<typeof damageStay>;

export const damageReport = z.object({
  id,
  property: z.object({ id, name: z.string() }),
  title: z.string(),
  description: z.string(),
  severity: DamageSeverity,
  status: DamageStatus,
  discoveredOn: isoDate,
  estimatedCostCents: nonNegativeCents.nullable(),
  claimReference: z.string().nullable(),
  resolutionNote: z.string().nullable(),
  booking: damageStay.nullable(),
  room: z.object({ id, displayName: z.string() }).nullable(),
  reportedBy: person,
  submittedAt: isoDateTime.nullable(),
  acknowledgedAt: isoDateTime.nullable(),
  claimFiledAt: isoDateTime.nullable(),
  resolvedAt: isoDateTime.nullable(),
  createdAt: isoDateTime,
  photoCount: z.number().int(),
  /** The first photo's thumbnail, for lists. */
  coverThumbUrl: z.string().nullable(),
  /**
   * The last day to file an AirCover claim (14 days after the stay's checkout), for Airbnb stays; null otherwise.
   */
  claimDeadline: isoDate.nullable(),
  /** What the caller may do with it, decided by the API. */
  can: z.object({ edit: z.boolean(), addPhotos: z.boolean(), submit: z.boolean(), manage: z.boolean() }),
});
export type DamageReport = z.infer<typeof damageReport>;

export const damageReportDetail = damageReport.extend({ photos: z.array(damagePhoto) });
export type DamageReportDetail = z.infer<typeof damageReportDetail>;

export const damageReportList = z.object({ items: z.array(damageReport) });
export type DamageReportList = z.infer<typeof damageReportList>;

/** Admins' list across properties. OPEN: not yet resolved (drafts included). */
export const damageReportQuery = z.object({
  propertyId: id.optional(),
  status: z.enum(['OPEN', 'RESOLVED', 'ALL']).default('ALL'),
});

export const createDamageReport = z.object({
  title,
  description,
  severity: DamageSeverity,
  discoveredOn: isoDate,
  bookingId: id.nullable().default(null),
  roomId: id.nullable().default(null),
  estimatedCostCents: nonNegativeCents.nullable().default(null),
});
export type CreateDamageReport = z.input<typeof createDamageReport>;

/** A draft's details. No defaults: a PATCH changes only what it names. */
export const updateDamageReport = z
  .object({
    title,
    description,
    severity: DamageSeverity,
    discoveredOn: isoDate,
    bookingId: id.nullable(),
    roomId: id.nullable(),
    estimatedCostCents: nonNegativeCents.nullable(),
  })
  .partial();
export type UpdateDamageReport = z.infer<typeof updateDamageReport>;

/** Attach an uploaded photo (both renditions, uploaded as DAMAGE_PHOTO for the report's property). */
export const addDamagePhoto = z.object({ fileId: id, thumbFileId: id });
export type AddDamagePhoto = z.infer<typeof addDamagePhoto>;

/** Admins move a report on (never back), and record the claim's reference or how it ended. */
export const setDamageStatus = z.object({
  status: z.enum(['ACKNOWLEDGED', 'CLAIM_FILED', 'RESOLVED']),
  claimReference: z.string().trim().min(1).max(120).nullable().optional(),
  resolutionNote: z.string().trim().min(1).max(2000).nullable().optional(),
  estimatedCostCents: nonNegativeCents.nullable().optional(),
});
export type SetDamageStatus = z.infer<typeof setDamageStatus>;

/** Stays a report could blame: those around the day the damage was found. */
export const damageStaysQuery = z.object({ on: isoDate });
export const damageStayList = z.object({ items: z.array(damageStay) });
export type DamageStayList = z.infer<typeof damageStayList>;
