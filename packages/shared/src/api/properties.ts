import { z } from 'zod';
import { nonNegativeCents } from '../money.js';
import { MembershipRole, RoomType } from '../enums.js';
import { bps, id, isoDate, isoDateTime, monthStart, text, timeOfDay } from '../primitives.js';

/**
 * Signed links to a property photo: `thumbUrl` (card-sized) for lists, `url` (large) for the property page. Links are
 * private and short-lived; they are signed per time window, so they stay identical (and cacheable) within it.
 */
export const propertyPhotoLinks = z.object({
  id,
  url: z.string(),
  thumbUrl: z.string(),
  expiresAt: isoDateTime,
});
export type PropertyPhotoLinks = z.infer<typeof propertyPhotoLinks>;

/**
 * Property as returned to any caller. Admin-only fields (default cleaner, cleaner pay, standard cleaning fee) are
 * optional and omitted (not null) for everyone else.
 */
export const property = z.object({
  id,
  name: z.string(),
  description: z.string().nullable(),
  bedrooms: z.number().int().nullable(),
  bathrooms: z.number().int().nullable(),
  halfBathrooms: z.number().int().nullable(),
  maxGuests: z.number().int().nullable(),
  airbnbUrl: z.string().nullable(),
  vrboUrl: z.string().nullable(),
  bookingComUrl: z.string().nullable(),
  addressLine1: z.string(),
  addressLine2: z.string().nullable(),
  city: z.string(),
  province: z.string(),
  postalCode: z.string(),
  country: z.string(),
  timeZone: z.string(),
  checkInTime: z.string(),
  checkOutTime: z.string(),
  provincialRegistrationNumber: z.string().nullable(),
  businessLicenceNumber: z.string().nullable(),
  archivedAt: isoDateTime.nullable(),
  /** The current cover photo, or null. */
  coverPhoto: propertyPhotoLinks.nullable(),
  defaultCleanerId: id.nullable().optional(),
  defaultCleanerPayCents: nonNegativeCents.optional(),
  standardCleaningFeeCents: nonNegativeCents.optional(),
});
export type Property = z.infer<typeof property>;

/** Field rules without defaults. Defaults belong to create only: in zod 4, `.partial()` still
 * applies defaults, which would silently reset fields on every PATCH. */
/** An https link to a listing on one platform (by its domain, including country domains such as airbnb.ca). */
const listingUrl = (platform: string, host: RegExp) =>
  z
    .string()
    .trim()
    .max(500)
    .refine((v) => {
      try {
        const u = new URL(v);
        return u.protocol === 'https:' && host.test(u.hostname);
      } catch {
        return false;
      }
    }, `Expected an https link to the ${platform} listing`)
    .nullable();
const count = (min: number, max: number) => z.number().int().min(min).max(max).nullable();

const propertyFields = {
  name: text(100),
  description: z.string().trim().max(1000).nullable(),
  bedrooms: count(0, 50),
  bathrooms: count(0, 50),
  halfBathrooms: count(0, 20),
  maxGuests: count(1, 100),
  airbnbUrl: listingUrl('Airbnb', /(^|\.)airbnb\.[a-z]{2,3}(\.[a-z]{2})?$/),
  vrboUrl: listingUrl('VRBO', /(^|\.)vrbo\.com$/),
  bookingComUrl: listingUrl('Booking.com', /(^|\.)booking\.com$/),
  addressLine1: text(200),
  addressLine2: text(200).nullable(),
  city: text(100),
  province: text(2),
  postalCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]\d[A-Z] ?\d[A-Z]\d$/, 'Expected a Canadian postal code'),
  timeZone: z.string().refine((tz) => Intl.supportedValuesOf('timeZone').includes(tz), 'Unknown time zone'),
  checkInTime: timeOfDay,
  checkOutTime: timeOfDay,
  provincialRegistrationNumber: text(50).nullable(),
  businessLicenceNumber: text(50).nullable(),
  defaultCleanerPayCents: nonNegativeCents,
  standardCleaningFeeCents: nonNegativeCents,
};

export const createProperty = z.object({
  ...propertyFields,
  addressLine2: propertyFields.addressLine2.default(null),
  description: propertyFields.description.default(null),
  bedrooms: propertyFields.bedrooms.default(null),
  bathrooms: propertyFields.bathrooms.default(null),
  halfBathrooms: propertyFields.halfBathrooms.default(null),
  maxGuests: propertyFields.maxGuests.default(null),
  airbnbUrl: propertyFields.airbnbUrl.default(null),
  vrboUrl: propertyFields.vrboUrl.default(null),
  bookingComUrl: propertyFields.bookingComUrl.default(null),
  province: propertyFields.province.default('BC'),
  timeZone: propertyFields.timeZone.default('America/Vancouver'),
  checkInTime: propertyFields.checkInTime.default('16:00'),
  checkOutTime: propertyFields.checkOutTime.default('11:00'),
  provincialRegistrationNumber: propertyFields.provincialRegistrationNumber.default(null),
  businessLicenceNumber: propertyFields.businessLicenceNumber.default(null),
  defaultCleanerPayCents: propertyFields.defaultCleanerPayCents.default(0),
  standardCleaningFeeCents: propertyFields.standardCleaningFeeCents.default(0),
});
export type CreateProperty = z.input<typeof createProperty>;

/** The default cleaner can only be set once the property has cleaners, so it is update-only. */
export const updateProperty = z.object({ ...propertyFields, defaultCleanerId: id.nullable() }).partial();
export type UpdateProperty = z.input<typeof updateProperty>;

/** Make two verified uploads (purpose PROPERTY_PHOTO) the property's cover: large and card renditions. */
export const setCoverPhoto = z.object({ fileId: id, thumbFileId: id });
export type SetCoverPhoto = z.infer<typeof setCoverPhoto>;

/**
 * Whether a property can be deleted. Only one with no financial records can (no bookings, expenses or receipts,
 * including cancelled or voided ones); any other is archived instead, so its records are kept.
 */
export const propertyDeletion = z.object({
  allowed: z.boolean(),
  bookings: z.number().int(),
  expenses: z.number().int(),
  receipts: z.number().int(),
});
export type PropertyDeletion = z.infer<typeof propertyDeletion>;

export const propertyListQuery = z.object({
  includeArchived: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default(false),
});

// ── Memberships ──

export const membership = z.object({
  id,
  role: MembershipRole,
  propertyId: id,
  user: z.object({ id, email: z.string(), firstName: z.string(), lastName: z.string() }),
  createdAt: isoDateTime,
  revokedAt: isoDateTime.nullable(),
});
export type Membership = z.infer<typeof membership>;

export const createMembership = z.object({ userId: id, role: MembershipRole });
export type CreateMembership = z.infer<typeof createMembership>;

export const membershipListQuery = z.object({
  includeRevoked: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default(false),
});

// ── Rooms ──

export const room = z.object({
  id,
  propertyId: id,
  name: z.string(),
  type: RoomType,
  sortOrder: z.number().int(),
  archivedAt: isoDateTime.nullable(),
});
export type Room = z.infer<typeof room>;

export const createRoom = z.object({ name: text(100), type: RoomType });
export type CreateRoom = z.infer<typeof createRoom>;

export const updateRoom = createRoom.partial();
export type UpdateRoom = z.infer<typeof updateRoom>;

export const reorderRooms = z.object({ roomIds: z.array(id).min(1).max(100) });
export type ReorderRooms = z.infer<typeof reorderRooms>;

// ── Plans ──

export const plan = z.object({
  id,
  name: z.string(),
  description: z.string().nullable(),
  managementFeeBps: bps,
  /** True once assigned to any property; the rate is then immutable. */
  inUse: z.boolean(),
  archivedAt: isoDateTime.nullable(),
});
export type Plan = z.infer<typeof plan>;

export const createPlan = z.object({
  name: text(100),
  description: z.string().trim().max(1000).nullable().default(null),
  managementFeeBps: bps,
});
export type CreatePlan = z.input<typeof createPlan>;

export const updatePlan = z
  .object({
    name: text(100),
    description: z.string().trim().max(1000).nullable(),
    managementFeeBps: bps,
  })
  .partial();
export type UpdatePlan = z.infer<typeof updatePlan>;

export const propertyPlanPeriod = z.object({
  id,
  plan: z.object({ id, name: z.string(), managementFeeBps: bps }),
  effectiveFrom: isoDate,
  effectiveTo: isoDate.nullable(),
});
export type PropertyPlanPeriod = z.infer<typeof propertyPlanPeriod>;

export const propertyPlanHistory = z.object({
  current: propertyPlanPeriod.nullable(),
  history: z.array(propertyPlanPeriod),
});
export type PropertyPlanHistory = z.infer<typeof propertyPlanHistory>;

export const assignPlan = z.object({ planId: id, effectiveFrom: monthStart });
export type AssignPlan = z.infer<typeof assignPlan>;
