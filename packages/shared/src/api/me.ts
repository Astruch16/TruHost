import { z } from 'zod';
import { MembershipRole, StaffRole, UserStatus } from '../enums.js';
import { id, text } from '../primitives.js';

export const meMembership = z.object({
  id,
  role: MembershipRole,
  property: z.object({ id, name: z.string() }),
});

export const me = z.object({
  id,
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().nullable(),
  staffRole: StaffRole.nullable(),
  status: UserStatus,
  memberships: z.array(meMembership),
});
export type Me = z.infer<typeof me>;

export const updateMe = z
  .object({
    firstName: text(100),
    lastName: text(100),
    phone: text(40).nullable(),
  })
  .partial();
export type UpdateMe = z.infer<typeof updateMe>;

export const appConfig = z.object({
  taxFieldsEnabled: z.boolean(),
});
export type AppConfig = z.infer<typeof appConfig>;
