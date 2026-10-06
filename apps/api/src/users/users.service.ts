import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { PageQuery, UpdateUser, UserListQuery } from '@truhost/shared';
import { AccessService } from '../access/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { Actor } from '../auth/actor.js';
import { IDENTITY_PROVIDER, type IdentityProvider } from '../auth/identity-provider.js';
import { cursorPage } from '../common/pagination.js';
import { notFound, ProblemException, unprocessable } from '../common/problem.js';
import type { User } from '../generated/prisma/client.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { clearDefaultCleaner } from '../properties/memberships.service.js';

const USER_FIELDS = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  staffRole: true,
  status: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    @Inject(IDENTITY_PROVIDER) private readonly identity: IdentityProvider,
  ) {}

  async list(actor: Actor, query: UserListQuery & PageQuery) {
    this.access.assert(actor, 'user:manage');
    const page = cursorPage(query, 'asc');
    const rows = await this.prisma.user.findMany({
      ...page.args,
      where: {
        status: query.status,
        staffRole: query.staffRole,
        ...(query.membershipRole ? { memberships: { some: { role: query.membershipRole, revokedAt: null } } } : {}),
      },
      select: USER_FIELDS,
    });
    return page.page(rows);
  }

  async get(actor: Actor, id: string) {
    this.access.assert(actor, 'user:manage');
    const user = await this.prisma.user.findUnique({ where: { id }, select: USER_FIELDS });
    if (!user) throw notFound('User');
    return user;
  }

  async update(actor: Actor, id: string, input: UpdateUser) {
    this.access.assert(actor, 'user:manage');
    return this.prisma.$transaction(async (tx) => {
      const before = await this.lockUser(tx, id);
      if (input.staffRole !== undefined && input.staffRole !== 'ADMIN' && before.staffRole === 'ADMIN') {
        if (id === actor.userId) {
          throw unprocessable('CANNOT_DEMOTE_SELF', 'You cannot remove your own admin role');
        }
        await this.assertNotLastAdmin(tx, id);
      }
      const after = await tx.user.update({ where: { id }, data: input });
      await this.audit.recordUpdate(
        tx,
        actor,
        { action: 'user.update', entityType: 'User', entityId: id },
        before,
        input,
      );
      return pick(after);
    });
  }

  async deactivate(actor: Actor, id: string) {
    this.access.assert(actor, 'user:manage');
    if (id === actor.userId) {
      throw unprocessable('CANNOT_DEACTIVATE_SELF', 'You cannot deactivate your own account');
    }
    const user = await this.prisma.$transaction(async (tx) => {
      const before = await this.lockUser(tx, id);
      if (before.status === 'DEACTIVATED') return before;
      if (before.staffRole === 'ADMIN') await this.assertNotLastAdmin(tx, id);
      const after = await tx.user.update({
        where: { id },
        data: { status: 'DEACTIVATED', deactivatedAt: new Date() },
      });
      await tx.invite.updateMany({
        where: { userId: id, status: 'PENDING' },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });
      await clearDefaultCleaner(tx, this.audit, actor, id);
      await this.audit.record(tx, actor, {
        action: 'user.deactivate',
        entityType: 'User',
        entityId: id,
        before: { status: before.status },
        after: { status: 'DEACTIVATED' },
      });
      return after;
    });
    // After commit: even if this call fails, the user is already locked out by our own status check.
    if (user.clerkUserId) await this.identity.revokeAccess(user.clerkUserId);
    return pick(user);
  }

  /**
   * Locks the target user together with every admin row, in id order, in one statement. Holding
   * the admin rows makes the last-admin check race-free; one ordered statement avoids deadlocks.
   */
  private async lockUser(tx: Tx, id: string): Promise<User> {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "User" WHERE id = ${id}::uuid OR "staffRole" = 'ADMIN' ORDER BY id FOR UPDATE`;
    if (!rows.some((r) => r.id === id)) throw notFound('User');
    return tx.user.findUniqueOrThrow({ where: { id } });
  }

  private async assertNotLastAdmin(tx: Tx, excludingId: string): Promise<void> {
    // Admin rows are already locked by lockUser.
    const others = await tx.user.count({
      where: { staffRole: 'ADMIN', status: { not: 'DEACTIVATED' }, id: { not: excludingId } },
    });
    if (others === 0) {
      throw new ProblemException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        code: 'LAST_ADMIN',
        detail: 'At least one admin must remain',
      });
    }
  }
}

function pick(u: User) {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    staffRole: u.staffRole,
    status: u.status,
    createdAt: u.createdAt,
  };
}
