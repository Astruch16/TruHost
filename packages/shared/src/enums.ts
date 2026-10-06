import { z } from 'zod';

// Mirrors of the Prisma enums. apps/api has a type test that fails if these drift.

export const StaffRole = z.enum(['ADMIN']);
export type StaffRole = z.infer<typeof StaffRole>;

export const UserStatus = z.enum(['INVITED', 'ACTIVE', 'DEACTIVATED']);
export type UserStatus = z.infer<typeof UserStatus>;

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
