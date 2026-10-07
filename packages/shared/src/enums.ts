import { z } from 'zod';

// Mirrors of the Prisma enums. apps/api has a type test that fails if these drift.

export const StaffRole = z.enum(['ADMIN']);
export type StaffRole = z.infer<typeof StaffRole>;

export const UserStatus = z.enum(['INVITED', 'ACTIVE', 'DEACTIVATED']);
export type UserStatus = z.infer<typeof UserStatus>;

export const Guide = z.enum(['SAGE', 'JUNIPER', 'PIP']);
export type Guide = z.infer<typeof Guide>;

export const InviteStatus = z.enum(['PENDING', 'ACCEPTED', 'REVOKED']);
export type InviteStatus = z.infer<typeof InviteStatus>;

export const MembershipRole = z.enum(['OWNER', 'CLEANER']);
export type MembershipRole = z.infer<typeof MembershipRole>;

export const RoomType = z.enum([
  'BEDROOM',
  'BATHROOM',
  'KITCHEN',
  'LIVING',
  'DINING',
  'LAUNDRY',
  'OUTDOOR',
  'ENTRY',
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
