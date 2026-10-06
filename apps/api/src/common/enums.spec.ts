import type * as shared from '@truhost/shared';
import type * as db from '../generated/prisma/enums.js';

// Compile-time guard: the zod enums in @truhost/shared must match the Prisma enums exactly.
// `pnpm typecheck` fails if either side gains or loses a member.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const checks: [
  Same<shared.StaffRole, db.StaffRole>,
  Same<shared.UserStatus, db.UserStatus>,
  Same<shared.InviteStatus, db.InviteStatus>,
  Same<shared.MembershipRole, db.MembershipRole>,
  Same<shared.RoomType, db.RoomType>,
  Same<shared.ActorType, db.ActorType>,
] = [true, true, true, true, true, true];

describe('shared enums', () => {
  it('match the database enums', () => {
    expect(checks.every(Boolean)).toBe(true);
  });
});
