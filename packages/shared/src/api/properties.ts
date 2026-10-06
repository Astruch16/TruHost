import { z } from 'zod';
import { nonNegativeCents } from '../money.js';
import { MembershipRole, RoomType } from '../enums.js';
import { bps, id, isoDate, isoDateTime, monthStart, text, timeOfDay } from '../primitives.js';

/**
 * Property as returned to any caller. Fields that only some roles may see are optional and
 * omitted (not null) when the caller lacks access: accessInstructions (admin, cleaner),
 * defaultCleanerPayCents (admin).
 */
export const property = z.object({
  id,
  name: z.string(),
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
  accessInstructions: z.string().nullable().optional(),
  defaultCleanerPayCents: nonNegativeCents.optional(),
});
export type Property = z.infer<typeof property>;

/** Field rules without defaults. Defaults belong to create only: in zod 4, `.partial()` still
 * applies defaults, which would silently reset fields on every PATCH. */
const propertyFields = {
  name: text(100),
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
  accessInstructions: z.string().trim().max(2000).nullable(),
  defaultCleanerPayCents: nonNegativeCents,
};

export const createProperty = z.object({
  ...propertyFields,
  addressLine2: propertyFields.addressLine2.default(null),
  province: propertyFields.province.default('BC'),
  timeZone: propertyFields.timeZone.default('America/Vancouver'),
  checkInTime: propertyFields.checkInTime.default('16:00'),
  checkOutTime: propertyFields.checkOutTime.default('11:00'),
  provincialRegistrationNumber: propertyFields.provincialRegistrationNumber.default(null),
  businessLicenceNumber: propertyFields.businessLicenceNumber.default(null),
  accessInstructions: propertyFields.accessInstructions.default(null),
  defaultCleanerPayCents: propertyFields.defaultCleanerPayCents.default(0),
});
export type CreateProperty = z.input<typeof createProperty>;

export const updateProperty = z.object(propertyFields).partial();
export type UpdateProperty = z.input<typeof updateProperty>;

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
