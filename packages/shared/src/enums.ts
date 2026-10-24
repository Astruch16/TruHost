import { z } from 'zod';

// Mirrors of the Prisma enums. apps/api has a type test that fails if these drift.

export const StaffRole = z.enum(['ADMIN']);
export type StaffRole = z.infer<typeof StaffRole>;

export const UserStatus = z.enum(['INVITED', 'ACTIVE', 'DEACTIVATED']);
export type UserStatus = z.infer<typeof UserStatus>;

export const Guide = z.enum(['SAGE', 'JUNIPER', 'PIP']);
export type Guide = z.infer<typeof Guide>;

export const MotionPreference = z.enum(['SYSTEM', 'REDUCED']);
export type MotionPreference = z.infer<typeof MotionPreference>;

export const NotificationCategory = z.enum([
  'SUPPLY_ALERTS',
  'DAMAGE_REPORTS',
  'INVITE_ACCEPTED',
  'WEEKLY_SUMMARY',
  'STATEMENT_RELEASED',
  'CLEAN_ASSIGNED',
  'PAYMENT_RECORDED',
  'CLEAN_COMPLETED',
]);
export type NotificationCategory = z.infer<typeof NotificationCategory>;

export const InviteStatus = z.enum(['PENDING', 'ACCEPTED', 'REVOKED']);
export type InviteStatus = z.infer<typeof InviteStatus>;

export const MembershipRole = z.enum(['OWNER', 'CLEANER']);
export type MembershipRole = z.infer<typeof MembershipRole>;

/** The welcome tours: one per role a user holds. */
export const OnboardingRole = z.enum(['ADMIN', 'OWNER', 'CLEANER']);
export type OnboardingRole = z.infer<typeof OnboardingRole>;

export const TourStatus = z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED']);
export type TourStatus = z.infer<typeof TourStatus>;

export const RoomType = z.enum([
  'BEDROOM',
  'BATHROOM',
  'HALF_BATH',
  'KITCHEN',
  'LIVING',
  'DINING',
  'LAUNDRY',
  'ENTRY',
  'OFFICE',
  'PATIO_DECK',
  'HOT_TUB',
  'GARAGE',
  'OTHER',
]);
export type RoomType = z.infer<typeof RoomType>;

export const ActorType = z.enum(['USER', 'SYSTEM']);
export type ActorType = z.infer<typeof ActorType>;

export const BookingSource = z.enum(['MANUAL', 'ICAL', 'PMS']);
export type BookingSource = z.infer<typeof BookingSource>;

export const BookingChannel = z.enum(['AIRBNB', 'VRBO', 'BOOKING_COM', 'DIRECT', 'OTHER']);
export type BookingChannel = z.infer<typeof BookingChannel>;

export const BookingKind = z.enum(['GUEST', 'OWNER_STAY', 'BLOCK']);
export type BookingKind = z.infer<typeof BookingKind>;

export const BookingStatus = z.enum(['CONFIRMED', 'CANCELLED']);
export type BookingStatus = z.infer<typeof BookingStatus>;

export const ExpenseCategory = z.enum([
  'CLEANING',
  'SUPPLIES',
  'REPAIRS_MAINTENANCE',
  'FURNISHINGS',
  'UTILITIES',
  'INTERNET',
  'SUBSCRIPTIONS',
  'LICENSING_PERMITS',
  'INSURANCE',
  'STRATA',
  'OTHER',
]);
export type ExpenseCategory = z.infer<typeof ExpenseCategory>;

export const ExpenseBearer = z.enum(['OWNER', 'TRUHOST']);
export type ExpenseBearer = z.infer<typeof ExpenseBearer>;

export const FilePurpose = z.enum(['RECEIPT', 'CLEAN_PHOTO', 'DAMAGE_PHOTO']);
export type FilePurpose = z.infer<typeof FilePurpose>;

export const FileStatus = z.enum(['PENDING', 'VERIFIED']);
export type FileStatus = z.infer<typeof FileStatus>;

export const SupplyCategory = z.enum(['BATHROOM', 'KITCHEN', 'LAUNDRY', 'CLEANING', 'OTHER']);
export type SupplyCategory = z.infer<typeof SupplyCategory>;

export const NotificationKind = z.enum(['SUPPLY_LOW', 'SUPPLY_OUT', 'DAMAGE_REPORTED', 'CLEAN_COMPLETED']);
export type NotificationKind = z.infer<typeof NotificationKind>;

export const DamageSeverity = z.enum(['MINOR', 'MODERATE', 'SEVERE']);
export type DamageSeverity = z.infer<typeof DamageSeverity>;

/** In workflow order; a report only moves forward. */
export const DamageStatus = z.enum(['DRAFT', 'SUBMITTED', 'ACKNOWLEDGED', 'CLAIM_FILED', 'RESOLVED']);
export type DamageStatus = z.infer<typeof DamageStatus>;

/** DRAFT → FINALIZED → RELEASED, forward only. */
export const StatementStatus = z.enum(['DRAFT', 'FINALIZED', 'RELEASED']);
export type StatementStatus = z.infer<typeof StatementStatus>;

export const StatementLineKind = z.enum(['STAY', 'EXPENSE', 'OWNER_STAY_CLEANING', 'ADJUSTMENT']);
export type StatementLineKind = z.infer<typeof StatementLineKind>;

export const CleanKind = z.enum(['TURNOVER', 'ADHOC']);
export type CleanKind = z.infer<typeof CleanKind>;

export const CleanStatus = z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETE', 'CANCELLED']);
export type CleanStatus = z.infer<typeof CleanStatus>;

export const PhotoPhase = z.enum(['BEFORE', 'AFTER']);
export type PhotoPhase = z.infer<typeof PhotoPhase>;
