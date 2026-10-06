import { z } from 'zod';
import { InviteStatus, MembershipRole, StaffRole, UserStatus } from '../enums.js';
import { email, id, isoDateTime, text } from '../primitives.js';

export const user = z.object({
  id,
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().nullable(),
  staffRole: StaffRole.nullable(),
  status: UserStatus,
  createdAt: isoDateTime,
});
export type User = z.infer<typeof user>;

export const userListQuery = z.object({
  status: UserStatus.optional(),
  staffRole: StaffRole.optional(),
  membershipRole: MembershipRole.optional(),
});
export type UserListQuery = z.infer<typeof userListQuery>;

export const updateUser = z
  .object({
    firstName: text(100),
    lastName: text(100),
    phone: text(40).nullable(),
    staffRole: StaffRole.nullable(),
  })
  .partial();
export type UpdateUser = z.infer<typeof updateUser>;

export const createInvite = z.object({
  email,
  firstName: text(100),
  lastName: text(100),
  staffRole: StaffRole.nullable().default(null),
  memberships: z
    .array(z.object({ propertyId: id, role: MembershipRole }))
    .max(50)
    .default([]),
});
export type CreateInvite = z.input<typeof createInvite>;

export const invite = z.object({
  id,
  status: InviteStatus,
  user: z.object({
    id,
    email: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    staffRole: StaffRole.nullable(),
  }),
  /** False when Clerk is not configured (local dev); the user can still be linked later. */
  emailSent: z.boolean(),
  acceptedAt: isoDateTime.nullable(),
  revokedAt: isoDateTime.nullable(),
  createdAt: isoDateTime,
});
export type Invite = z.infer<typeof invite>;
