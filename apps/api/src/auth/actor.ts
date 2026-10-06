import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { MembershipRole, StaffRole } from '../generated/prisma/enums.js';

/**
 * The authenticated caller, resolved once per request by AuthGuard. Memberships are loaded fresh
 * on every request, so a revoked membership loses access immediately.
 */
export interface Actor {
  userId: string;
  staffRole: StaffRole | null;
  memberships: ReadonlyArray<{ propertyId: string; role: MembershipRole }>;
  requestId?: string;
  ip?: string;
}

export interface ActorRequest {
  actor?: Actor;
  id?: string;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

export const CurrentActor = createParamDecorator((_: unknown, ctx: ExecutionContext): Actor => {
  const actor = ctx.switchToHttp().getRequest<ActorRequest>().actor;
  if (!actor) throw new Error('CurrentActor used on a route without an authenticated actor');
  return actor;
});

export const IS_PUBLIC = 'truhost:public';
/** Skips authentication. Only for /health and similar. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
